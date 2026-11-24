import path from "path";
import slugify from "slugify";
import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import {
  BecomeSellerInput,
  UpdateSellerInput,
  ListPublicSellersQueryInput,
  SellerCategoryOption,
  SellerOnboardingType,
} from "./seller.validation";
import { processImage } from "../../workers/image/imageWorker.pool";
import { getDocRequirements } from "../../config/sellerKyc";
import {
  getPaginationParams,
  buildPagination,
  generateTimestampSuffix,
  isUniqueViolation,
  withUniqueRetry,
  generateReferenceCode,
  generateSlug,
  ensureCategory,
  assertCanBecomeIndividualSeller,
  assertCanCreateOrganization,
  readyVideoRelationSelect,
  withVideoUrls,
  uploadLocalFile,
} from "../../helpers";
import {
  SellerType,
  SellerStatus,
  ListingStatus,
  BlogStatus,
  VerificationStatus,
  MemberScope,
  MemberStatus,
} from "../../generated/prisma/enums";

import type { Prisma } from "../../generated/prisma/client";

import { ensureIndividualSellerRole } from "../../helpers/sellingEntity.helper";



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
  videoUploads: readyVideoRelationSelect,
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
  sellerStatus: true,
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
  // NOTE: `properties` is NOT counted here — SellerProfile no longer has a
  // properties relation. The count depends on sellerType (own user_id vs
  // the organization's id), so it is computed separately.
  _count: {
    select: { followers: true, faqs: true, blogPosts: true, ratings: true },
  },
} as const;

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

  return {
    data: categories,
    ...buildPagination(total, p, l),
  };
};

const checkOnboardingEligibility = async (userId: string) => {
  const check = async (fn: () => Promise<void>) => {
    try {
      await fn();
      return { allowed: true, reason: null as string | null };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof ApiError ? error.message : "Not eligible",
      };
    }
  };

  const [individual, organization] = await Promise.all([
    check(() => assertCanBecomeIndividualSeller(userId)),
    check(() => assertCanCreateOrganization(userId)),
  ]);

  return { individual, organization };
};

const getSellerOnboardingFields = async (
  userId: string,
  sellerType: SellerOnboardingType
) => {
  const [categories, eligibility] = await Promise.all([
    prisma.sellerCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
      },
    }),
    checkOnboardingEligibility(userId),
  ]);

  const categoryOptions: SellerCategoryOption[] = categories.map((category) => ({
    value: category.id,
    label: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.imageUrl,
  }));

  return {
    sellerType,
    eligibility: {
      canBecomeIndividualSeller: eligibility.individual.allowed,
      canCreateOrganization: eligibility.organization.allowed,
      reason:
        sellerType === "ORGANIZATION"
          ? eligibility.organization.reason
          : eligibility.individual.reason,
    },
    categories: categoryOptions,
  };
};

/**
 * Registers the caller as an INDIVIDUAL seller.
 *
 * Company sellers are deliberately not created here — see
 * organization.service.createOrganization, which creates the company, its
 * roles and its owner's membership together in one transaction. Keeping two
 * entry points for "become a seller" meant the org's public profile could end
 * up owned by nobody, or the owner could hold two unrelated seller profiles.
 *
 * The "owner could hold two unrelated seller profiles" case is prevented by
 * `assertCanBecomeIndividualSeller`, which shares its lookup with the mirror
 * guard on `createOrganization`. That way neither entry point can be edited
 * into the other one. Staff and agents of a company are unaffected — they may
 * still sell in their own name, because that is not a second public presence
 * for the company.
 */
const becomeSeller = async (userId: string, data: BecomeSellerInput) => {
  const { name, panNumber, aadhaarNumber, reraNumber, ...profileData } = data;

  // Runs before ensureCategory on purpose: "you already own a company" is the
  // answer the caller can act on, whereas an invalid categoryId would just send
  // them off to re-pick a category they are not allowed to use anyway.
  await assertCanBecomeIndividualSeller(userId);

  await ensureCategory(profileData.categoryId);

  let slugBase = name?.trim();
  if (!slugBase) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        phone: true,
        person: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    const fullName = user?.person
      ? [user.person.firstName, user.person.lastName]
          .filter(Boolean)
          .join(" ")
          .trim()
      : "";

    slugBase =
      fullName ||
      user?.email?.split("@")[0] ||
      user?.phone ||
      "seller";
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
          // Explicit, because the CHECK constraint requires organization_id to
          // be NULL for an INDIVIDUAL profile and the absence of a field would
          // otherwise be an implicit bet on the default.
          organizationId: null,
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

      const roleId = await ensureIndividualSellerRole(tx, userId);
      const membership = await tx.member.findFirst({
        where: {
          scope: MemberScope.INDIVIDUAL,
          contextId: null,
          userId,
        },
        select: { id: true },
      });

      if (membership) {
        await tx.member.update({
          where: { id: membership.id },
          data: { roleId, status: MemberStatus.ACTIVE },
        });
      } else {
        await tx.member.create({
          data: {
            scope: MemberScope.INDIVIDUAL,
            contextId: null,
            userId,
            roleId,
            status: MemberStatus.ACTIVE,
          },
        });
      }

      return withVideoUrls(
        (await tx.sellerProfile.findUnique({
          where: { id: created.id },
          select: sellerProfileSelect,
        }))!
      );
    })
  );
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

  return withVideoUrls({
    ...seller,
    kyc: { requirements: kycRequirements, complete: kycComplete },
  });
};

/**
 * Updates the caller's INDIVIDUAL profile.
 *
 * Company business details are NOT editable here — a company profile is a
 * claim made by the company, so it is edited through
 * PATCH /organizations/:orgId by a member with that permission. Note the
 * lookup is by userId, and an ORGANIZATION SellerProfile has user_id NULL, so
 * this can never touch a company's profile even by mistake.
 */
const updateSeller = async (userId: string, data: UpdateSellerInput) => {
  const { name, panNumber, aadhaarNumber, reraNumber, ...profileData } = data;

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

    return tx.sellerProfile.update({
      where: { id: seller.id },
      data: {
        ...(panNumber !== undefined ? { panNumber } : {}),
        ...(aadhaarNumber !== undefined ? { aadhaarNumber } : {}),
        ...(reraNumber !== undefined ? { reraNumber } : {}),
        ...profileData,
      },
      select: sellerProfileSelect,
    });
  });

  return withVideoUrls(updated);
};

const updateSlug = async (userId: string, slug: string) => {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) {
    throw new ApiError(403, "You are not registered as a seller");
  }

  const newSlug = slugify(slug, { lower: true, strict: true });

  if (seller.slug === newSlug) {
    return withVideoUrls(
      (await prisma.sellerProfile.findUnique({
        where: { id: seller.id },
        select: sellerProfileSelect,
      }))!
    );
  }

  try {
    return withVideoUrls(
      await prisma.sellerProfile.update({
        where: { id: seller.id },
        data: { slug: newSlug },
        select: sellerProfileSelect,
      })
    );
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

  const uploaded = await uploadLocalFile(
    result.outputs[0],
    `sellers/${suffix}s`,
    "image/webp"
  );
  if (!uploaded.url) {
    throw new ApiError(500, "Public image URL is missing");
  }

  const url = uploaded.url;

  await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: suffix === "logo" ? { logoUrl: url } : { coverPhotoUrl: url },
  });

  return url;
};

const publicSellerCardSelect = {
  id: true,
  userId: true,
  organizationId: true,
  referenceCode: true,
  slug: true,
  sellerType: true,
  headline: true,
  logoUrl: true,
  city: true,
  state: true,
  verificationStatus: true,
  isAvailable: true,
  category: { select: { id: true, name: true, slug: true } },
  user: {
    select: {
      person: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  },
  organization: { select: { name: true } },
  ratings: { where: { status: "PUBLISHED" }, select: { rating: true } },
  _count: { select: { followers: true } },
} satisfies Prisma.SellerProfileSelect;

const countPropertiesForSeller = async (seller: {
  sellerType: SellerType;
  userId: string | null;
  organizationId: string | null;
}) =>
  prisma.property.count({
    where: {
      ...(seller.sellerType === SellerType.ORGANIZATION
        ? seller.organizationId
          ? { organizationId: seller.organizationId }
          : { id: "__none__" }
        : seller.userId
          ? { userId: seller.userId, organizationId: null }
          : { id: "__none__" }),
      listingStatus: { not: ListingStatus.DELETED },
    },
  });

const listPublicSellers = async (query: ListPublicSellersQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where: Prisma.SellerProfileWhereInput = {
    sellerStatus: SellerStatus.ACTIVE,
  };

  if (query.city) where.city = { equals: query.city, mode: "insensitive" };
  if (query.category) where.category = { slug: query.category };
  if (query.verified) {
    where.verificationStatus =
      query.verified === "true"
        ? VerificationStatus.VERIFIED
        : { not: VerificationStatus.VERIFIED };
  }
  if (query.q) {
    where.OR = [
      { headline: { contains: query.q, mode: "insensitive" } },
      { about: { contains: query.q, mode: "insensitive" } },
      {
        user: {
          person: { firstName: { contains: query.q, mode: "insensitive" } },
        },
      },
      {
        user: {
          person: { lastName: { contains: query.q, mode: "insensitive" } },
        },
      },
      { organization: { name: { contains: query.q, mode: "insensitive" } } },
      { category: { name: { contains: query.q, mode: "insensitive" } } },
    ];
  }

  const [sellers, total] = await Promise.all([
    prisma.sellerProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: publicSellerCardSelect,
    }),
    prisma.sellerProfile.count({ where }),
  ]);

  const data = await Promise.all(
    sellers.map(async (seller) => {
      const { ratings, _count, user, organization, ...rest } = seller;
      const averageRating =
        ratings.length > 0
          ? Math.round(
              (ratings.reduce((sum, item) => sum + item.rating, 0) /
                ratings.length) *
                100
            ) / 100
          : null;

      const name =
        seller.sellerType === SellerType.ORGANIZATION
          ? organization?.name ?? seller.headline ?? "Organization"
          : [user?.person?.firstName, user?.person?.lastName]
              .filter(Boolean)
              .join(" ") ||
            seller.headline ||
            "Seller";

      return {
        ...rest,
        name,
        avatarUrl:
          seller.sellerType === SellerType.ORGANIZATION
            ? seller.logoUrl
            : user?.person?.avatarUrl ?? seller.logoUrl,
        averageRating,
        ratingCount: ratings.length,
        propertiesCount: await countPropertiesForSeller(seller),
        followersCount: _count.followers,
      };
    })
  );

  return {
    data,
    ...buildPagination(total, page, limit),
  };
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
      videoUploads: readyVideoRelationSelect,
      locations: true,
      bankApprovalList: true,
      achievements: true,
      socialLinks: true,
      contactPhone: true,
      contactEmail: true,
      showContactToBuyers: true,
      verificationStatus: true,
      sellerStatus: true,
      userId: true,
      organizationId: true,
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
      // blogPosts is filtered to PUBLISHED so a seller's public page never
      // reveals how many drafts or archived posts they have.
      _count: {
        select: {
          followers: true,
          ratings: true,
          faqs: true,
          blogPosts: { where: { status: BlogStatus.PUBLISHED } },
        },
      },
      ratings: { where: { status: "PUBLISHED" }, select: { rating: true } },
      // Active FAQs ki actual list — buyer profile pe padh sake (sirf count nahi)
      faqs: {
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
        select: { id: true, question: true, answer: true, displayOrder: true },
      },
    },
  });

  if (!seller || seller.sellerStatus !== SellerStatus.ACTIVE) {
    throw new ApiError(404, "Seller not found");
  }

  const { panNumber, aadhaarNumber, contactPhone, contactEmail, ratings, ...rest } = seller;
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 100) / 100
      : null;

  // Public listing count. An org's profile advertises the whole company
  // portfolio, not one member's listings, so the count is resolved from
  // whichever side owns the profile.
  const propertiesCount = await prisma.property.count({
    where: {
      ...(seller.sellerType === SellerType.ORGANIZATION
        ? seller.organizationId
          ? { organizationId: seller.organizationId }
          : { id: "__none__" }
        : seller.userId
          ? { userId: seller.userId, organizationId: null }
          : { id: "__none__" }),
      listingStatus: { not: ListingStatus.DELETED },
    },
  });

  return withVideoUrls({
    ...rest,
    panNumber: maskPan(panNumber),
    aadhaarNumber: maskAadhaar(aadhaarNumber),
    contactPhone: seller.showContactToBuyers ? contactPhone : null,
    contactEmail: seller.showContactToBuyers ? contactEmail : null,
    averageRating,
    ratingCount: ratings.length,
    _count: { ...seller._count, properties: propertiesCount },
  });
};

// Public seller FAQ list — buyer profile pe FAQ section lazy-load kar sake.
// Profile response me faqs ek saath aate hain; dedicated endpoint alag se sirf FAQ deta hai.
const listPublicFaqs = async (slug: string) => {
  const seller = await prisma.sellerProfile.findFirst({
    where: { slug, sellerStatus: SellerStatus.ACTIVE },
    select: {
      id: true,
      faqs: {
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
        select: { id: true, question: true, answer: true, displayOrder: true },
      },
    },
  });

  if (!seller) {
    throw new ApiError(404, "Seller not found");
  }

  return seller.faqs;
};

export {
  becomeSeller,
  getMySeller,
  updateSeller,
  updateSlug,
  updateMedia,
  getCategories,
  getSellerOnboardingFields,
  listPublicSellers,
  getPublicProfile,
  listPublicFaqs,
};
