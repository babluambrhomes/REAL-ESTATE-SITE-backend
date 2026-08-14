import path from "path";
import slugify from "slugify";
import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { BecomeSellerInput, UpdateSellerInput } from "./seller.validation";
import { processImage } from "../../workers/image/imageWorker.pool";
import { getDocRequirements } from "../../config/sellerKyc";
import { getPaginationParams, buildPaginatedResponse, generateTimestampSuffix, isUniqueViolation, withUniqueRetry } from "../../helpers";
import {
  SellerType,
  MemberScope,
  MemberStatus,
  RoleScope,
} from "../../generated/prisma/enums";

const sellerProfileSelect = {
  id: true,
  userId: true,
  referenceCode: true,
  slug: true,
  sellerType: true,
  organizationId: true,
  categoryId: true,
  headline: true,
  about: true,
  experienceYears: true,
  specializations: true,
  languages: true,
  logoUrl: true,
  coverPhotoUrl: true,
  addressLine: true,
  city: true,
  state: true,
  country: true,
  pincode: true,
  panNumber: true,
  aadhaarNumber: true,
  reraNumber: true,
  happyClientsCount: true,
  responseTimeMinutes: true,
  isAvailable: true,
  availabilityDetails: true,
  videos: true,
  locations: true,
  bankApprovalList: true,
  achievements: true,
  socialLinks: true,
  contactPhone: true,
  contactEmail: true,
  showContactToBuyers: true,
  leadPreferences: true,
  verificationStatus: true,
  verifiedAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: { id: true, name: true, slug: true, imageUrl: true },
  },
  organization: {
    select: {
      id: true,
      name: true,
      description: true,
      website: true,
      registrationNumber: true,
      gstNumber: true,
      yearEstablished: true,
      employeeCount: true,
      verificationStatus: true,
      status: true,
    },
  },
  user: {
    select: {
      id: true,
      email: true,
      phone: true,
      emailVerified: true,
      phoneVerified: true,
      person: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  },
  _count: {
    select: { followers: true, properties: true, faqs: true, blogPosts: true, ratings: true },
  },
} as const;

const generateReferenceCode = (): string => `SELL-${generateTimestampSuffix()}`;


const generateSlug = (base: string): string => {
  const clean = slugify(base, { lower: true, strict: true }) || "seller";
  return `${clean}-${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
};

const ensureCategory = async (categoryId?: string) => {
  if (!categoryId) return;
  const category = await prisma.sellerCategory.findUnique({ where: { id: categoryId } });
  if (!category || !category.isActive) {
    throw new ApiError(400, "Invalid seller category");
  }
};

const maskPan = (pan?: string | null): string | null =>
  pan ? `${pan.slice(0, 2)}***${pan.slice(-1)}` : null;

const maskAadhaar = (aadhaar?: string | null): string | null =>
  aadhaar ? `XXXX-XXXX-${aadhaar.slice(-4)}` : null;


// becomeSeller, getMySeller, updateSeller, updateSlug, updateMedia, getCategories, getPublicProfile

const getCategories = async (page: number, limit: number) => {
  const { skip, take, page: p, limit: l } = getPaginationParams({ page, limit });

  const [categories, total] = await Promise.all([
    prisma.sellerCategory.findMany({
      where: { isActive: true },
      skip,
      take,
      orderBy: { name: "asc" },
    }),
    prisma.sellerCategory.count({ where: { isActive: true } }),
  ]);

  return buildPaginatedResponse(categories, total, p, l);
};

const becomeSeller = async (userId: string, data: BecomeSellerInput) => {
  const { sellerType, name, organization, panNumber, aadhaarNumber, reraNumber, ...profileData } = data;

  const existing = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (existing) {
    throw new ApiError(409, "You are already registered as a seller");
  }

  await ensureCategory(profileData.categoryId);

  if (sellerType === SellerType.INDIVIDUAL) {
    let slugBase = name;
    if (!slugBase) {
      const person = await prisma.person.findUnique({
        where: { userId },
        select: { firstName: true, lastName: true },
      });
      slugBase = person ? `${person.firstName} ${person.lastName}`.trim() : "";
    }

    return withUniqueRetry(() =>
      prisma.$transaction(async (tx) => {
        if (name) {
          await tx.person.upsert({
            where: { userId },
            create: { userId, firstName: name, lastName: "" },
            update: { firstName: name },
          });
        }

        const created = await tx.sellerProfile.create({
          data: {
            userId,
            referenceCode: generateReferenceCode(),
            slug: generateSlug(slugBase),
            sellerType: SellerType.INDIVIDUAL,
            ...(panNumber ? { panNumber } : {}),
            ...(aadhaarNumber ? { aadhaarNumber } : {}),
            ...(reraNumber ? { reraNumber } : {}),
            ...profileData,
          },
          select: { id: true },
        });

        return tx.sellerProfile.findUnique({
          where: { id: created.id },
          select: sellerProfileSelect,
        });
      })
    );
  } else if (sellerType === SellerType.ORGANIZATION) {
    const orgName = organization?.name || name;
    if (!orgName) {
      throw new ApiError(400, "Organization name is required");
    }

    return withUniqueRetry(() =>
      prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: orgName,
            description: organization?.description,
            website: organization?.website,
            registrationNumber: organization?.registrationNumber,
            gstNumber: organization?.gstNumber,
            yearEstablished: organization?.yearEstablished,
            employeeCount: organization?.employeeCount,
            createdBy: userId,
          },
        });

        const ownerRole = await tx.role.create({
          data: {
            scope: RoleScope.ORGANIZATION,
            contextId: org.id,
            roleName: "Owner",
            isSystemRole: true,
            createdBy: userId,
          },
        });

        await tx.member.create({
          data: {
            scope: MemberScope.ORGANIZATION,
            contextId: org.id,
            userId,
            roleId: ownerRole.id,
            status: MemberStatus.ACTIVE,
          },
        });

        const created = await tx.sellerProfile.create({
          data: {
            userId,
            organizationId: org.id,
            referenceCode: generateReferenceCode(),
            slug: generateSlug(orgName),
            sellerType: SellerType.ORGANIZATION,
            ...(panNumber ? { panNumber } : {}),
            ...(aadhaarNumber ? { aadhaarNumber } : {}),
            ...(reraNumber ? { reraNumber } : {}),
            ...profileData,
          },
          select: { id: true },
        });

        return tx.sellerProfile.findUnique({
          where: { id: created.id },
          select: sellerProfileSelect,
        });
      })
    );
  } else {
    throw new ApiError(400, "Invalid seller type");
  }
};

const getMySeller = async (userId: string) => {
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId },
    select: sellerProfileSelect,
  });

  if (!seller) {
    throw new ApiError(403, "You are not registered as a seller");
  }

  const owner =
    seller.sellerType === SellerType.INDIVIDUAL
      ? { sellerId: seller.id }
      : { organizationId: seller.organizationId };

  const [docs, requirements] = await Promise.all([
    prisma.sellerVerificationDocument.findMany({
      where: owner,
      select: { docType: true, status: true, rejectionReason: true },
    }),
    Promise.resolve(getDocRequirements(seller.sellerType)),
  ]);

  const docMap = new Map(docs.map((doc) => [doc.docType, doc]));

  const kycRequirements = requirements.map((req) => {
    const doc = docMap.get(req.docType);
    return {
      docType: req.docType,
      displayLabel: req.displayLabel,
      isRequired: req.isRequired,
      displayOrder: req.displayOrder,
      submitted: Boolean(doc),
      status: doc?.status ?? null,
      rejectionReason: doc?.rejectionReason ?? null,
    };
  });

  const kycComplete = requirements
    .filter((req) => req.isRequired)
    .every((req) => docMap.get(req.docType)?.status === "VERIFIED");

  return { ...seller, kyc: { requirements: kycRequirements, complete: kycComplete } };
};

const updateSeller = async (userId: string, data: UpdateSellerInput) => {
  const { name, organization, panNumber, aadhaarNumber, reraNumber, ...profileData } = data;

  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) {
    throw new ApiError(403, "You are not registered as a seller");
  }

  await ensureCategory(profileData.categoryId);

  const updated = await prisma.$transaction(async (tx) => {
    if (name) {
      await tx.person.upsert({
        where: { userId },
        create: { userId, firstName: name, lastName: "" },
        update: { firstName: name },
      });
    }

    const profile = await tx.sellerProfile.update({
      where: { id: seller.id },
      data: {
        ...(panNumber !== undefined ? { panNumber } : {}),
        ...(aadhaarNumber !== undefined ? { aadhaarNumber } : {}),
        ...(reraNumber !== undefined ? { reraNumber } : {}),
        ...profileData,
      },
      select: sellerProfileSelect,
    });

    if (organization && seller.sellerType === SellerType.ORGANIZATION && seller.organizationId) {
      await tx.organization.update({
        where: { id: seller.organizationId },
        data: organization,
      });
    }

    return profile;
  });

  return updated;
};

const updateSlug = async (userId: string, slug: string) => {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) {
    throw new ApiError(403, "You are not registered as a seller");
  }

  const newSlug = slugify(slug, { lower: true, strict: true });

  if (seller.slug === newSlug) {
    return prisma.sellerProfile.findUnique({
      where: { id: seller.id },
      select: sellerProfileSelect,
    });
  }

  try {
    return await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: { slug: newSlug },
      select: sellerProfileSelect,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ApiError(409, "This slug is already taken by another seller");
    }
    throw err;
  }
};

const updateMedia = async (
  userId: string,
  file: Express.Multer.File | undefined,
  suffix: "logo" | "cover",
  width: number,
  height?: number
) => {
  if (!file) {
    throw new ApiError(400, "No file uploaded");
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!seller) {
    throw new ApiError(403, "You are not registered as a seller");
  }

  const parsed = path.parse(file.path);
  const result = await processImage({
    inputPath: file.path,
    outputDir: parsed.dir,
    originalName: path.parse(file.originalname).name,
    deleteOriginal: true,
    outputs: [
      {
        suffix,
        width,
        height,
        fit: height ? "cover" : "inside",
        format: "webp",
        quality: 85,
      },
    ],
  });

  if (!result.ok) {
    throw new ApiError(500, result.error || "Image processing failed");
  }

  const relPath = path.relative(parsed.dir, result.outputs[0]).split(path.sep).join("/");
  const url = `/uploads/${relPath}`;

  await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: suffix === "logo" ? { logoUrl: url } : { coverPhotoUrl: url },
  });

  return url;
};

const getPublicProfile = async (slug: string) => {
  const seller = await prisma.sellerProfile.findUnique({
    where: { slug },
    select: {
      id: true,
      referenceCode: true,
      slug: true,
      sellerType: true,
      headline: true,
      about: true,
      experienceYears: true,
      specializations: true,
      languages: true,
      logoUrl: true,
      coverPhotoUrl: true,
      addressLine: true,
      city: true,
      state: true,
      country: true,
      pincode: true,
      panNumber: true,
      aadhaarNumber: true,
      reraNumber: true,
      happyClientsCount: true,
      responseTimeMinutes: true,
      isAvailable: true,
      availabilityDetails: true,
      videos: true,
      locations: true,
      bankApprovalList: true,
      achievements: true,
      socialLinks: true,
      contactPhone: true,
      contactEmail: true,
      showContactToBuyers: true,
      verificationStatus: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: { id: true, name: true, slug: true, imageUrl: true },
      },
      organization: {
        select: {
          id: true,
          name: true,
          description: true,
          website: true,
          verificationStatus: true,
        },
      },
      user: {
        select: {
          person: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      },
      _count: { select: { followers: true, properties: true, ratings: true, faqs: true } },
      ratings: { where: { status: "PUBLISHED" }, select: { rating: true } },
    },
  });

  if (!seller || !seller.isActive || seller.deletedAt) {
    throw new ApiError(404, "Seller not found");
  }

  const { panNumber, aadhaarNumber, contactPhone, contactEmail, ratings, ...rest } = seller;
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 100) / 100
      : null;

  return {
    ...rest,
    panNumber: maskPan(panNumber),
    aadhaarNumber: maskAadhaar(aadhaarNumber),
    contactPhone: seller.showContactToBuyers ? contactPhone : null,
    contactEmail: seller.showContactToBuyers ? contactEmail : null,
    averageRating,
    ratingCount: ratings.length,
  };
};

export {
  becomeSeller,
  getMySeller,
  updateSeller,
  updateSlug,
  updateMedia,
  getCategories,
  getPublicProfile,
};
