import path from "path";
import fs from "fs/promises";
import slugify from "slugify";
import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { getPaginationParams, buildPaginatedResponse, generateTimestampSuffix, isUniqueViolation, withUniqueRetry } from "../../helpers";
import { processImage } from "../../workers/image/imageWorker.pool";
import { PropertyStatus } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import {
  CreatePropertyInput,
  UpdatePropertyInput,
  CreateVariantInput,
  UpdateVariantInput,
  ListQueryInput,
} from "./property.validation";

const propertyCardSelect: Prisma.PropertySelect = {
  id: true,
  propertyCode: true,
  title: true,
  slug: true,
  description: true,
  transactionType: true,
  propertyType: true,
  propertyStatus: true,
  city: true,
  state: true,
  pincode: true,
  images: true,
  isFeatured: true,
  isVerified: true,
  viewsCount: true,
  likesCount: true,
  averageRating: true,
  ratingCount: true,
  createdAt: true,
  seller: {
    select: {
      id: true,
      referenceCode: true,
      slug: true,
      sellerType: true,
      headline: true,
      logoUrl: true,
    },
  },
  variants: {
    where: { isActive: true },
    orderBy: { price: "asc" },
    select: {
      id: true,
      variantName: true,
      bedrooms: true,
      price: true,
      mrpPrice: true,
      pricePerSqft: true,
      totalArea: true,
      totalAreaUnit: true,
      furnishingStatus: true,
      availabilityStatus: true,
      isAvailable: true,
      images: true,
    },
  },
};

const propertyDetailSelect: Prisma.PropertySelect = {
  ...propertyCardSelect,
  addressLine: true,
  country: true,
  latitude: true,
  longitude: true,
  googleMapLink: true,
  ownershipType: true,
  listedBy: true,
  ageOfProperty: true,
  amenities: true,
  nearbyPlaces: true,
  societyInfo: true,
  videoUrl: true,
  virtualTourUrl: true,
  reraNumber: true,
  registrationNumber: true,
  taxAssessment: true,
  encumbrance: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  metaTitle: true,
  metaDescription: true,
  metaKeywords: true,
  isActive: true,
  verifiedAt: true,
  updatedAt: true,
  variants: {
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { price: "asc" }],
    select: {
      id: true,
      variantName: true,
      variantCode: true,
      bedrooms: true,
      bathrooms: true,
      balconies: true,
      price: true,
      mrpPrice: true,
      pricePerSqft: true,
      totalArea: true,
      totalAreaUnit: true,
      carpetArea: true,
      carpetAreaUnit: true,
      superBuiltUpArea: true,
      superBuiltUpAreaUnit: true,
      plotArea: true,
      plotAreaUnit: true,
      floorNumber: true,
      totalFloors: true,
      availabilityStatus: true,
      possessionDate: true,
      isAvailable: true,
      inventoryCount: true,
      furnishingStatus: true,
      furnishingItems: true,
      images: true,
      brochure: true,
      displayOrder: true,
    },
  },
  faqs: {
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, question: true, answer: true, displayOrder: true },
  },
};

const asImageList = (
  value: unknown
): { url: string; isFeatured?: boolean }[] => {
  if (!Array.isArray(value)) return [];
  return value as { url: string; isFeatured?: boolean }[];
};

const toCard = (property: any) => {
  const images: { url: string; isFeatured?: boolean }[] = asImageList(property.images);
  const featuredImage =
    images.find((i) => i.isFeatured)?.url ?? images[0]?.url ?? null;
  const minPrice = property.variants?.[0]?.price ?? null;

  const { images: _imgs, variants: _variants, ...rest } = property;

  return {
    ...rest,
    minPrice,
    featuredImage,
    imagesCount: images.length,
    variants: property.variants,
  };
};

const generatePropertyCode = (): string => `PROP-${generateTimestampSuffix()}`;

const generateVariantCode = (): string => `VRT-${generateTimestampSuffix()}`;

const generateUniqueSlug = (title: string): string => {
  const base = slugify(title, { lower: true, strict: true }) || "property";
  return `${base}-${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
};

const ensureOwnProperty = async (sellerId: string, propertyId: string) => {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, sellerId, deletedAt: null },
    select: { id: true, title: true, organizationId: true },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  return property;
};

const findOwnPropertyWithImages = async (sellerId: string, propertyId: string) => {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, sellerId, deletedAt: null },
    select: { id: true, images: true },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  return property;
};

const ensureOwnVariant = async (
  sellerId: string,
  propertyId: string,
  variantId: string,
  select?: { id?: boolean; images?: boolean }
) => {
  const variant = await prisma.propertyVariant.findFirst({
    where: {
      id: variantId,
      property: { id: propertyId, sellerId, deletedAt: null },
    },
    select: select ?? { id: true },
  });

  if (!variant) {
    throw new ApiError(404, "Variant not found");
  }

  return variant;
};

const ensureOrgOwnership = async (sellerId: string, organizationId?: string) => {
  if (!organizationId) return;

  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { organizationId: true },
  });

  if (seller?.organizationId !== organizationId) {
    throw new ApiError(400, "Organization does not belong to this seller");
  }
};

const processPropertyImages = async (files: Express.Multer.File[]) => {
  const urls: string[] = [];

  for (const file of files) {
    const parsed = path.parse(file.path);
    const result = await processImage({
      inputPath: file.path,
      outputDir: parsed.dir,
      originalName: path.parse(file.originalname).name,
      deleteOriginal: true,
      outputs: [
        {
          suffix: "property",
          width: 800,
          height: 600,
          fit: "cover",
          format: "webp",
          quality: 85,
        },
      ],
    });

    if (!result.ok) {
      throw new ApiError(500, result.error || "Image processing failed");
    }

    const relPath = path
      .relative(parsed.dir, result.outputs[0])
      .split(path.sep)
      .join("/");

    urls.push(`/uploads/${relPath}`);
  }

  return urls;
};

const createProperty = async (
  sellerId: string,
  data: CreatePropertyInput
) => {
  await ensureOrgOwnership(sellerId, data.organizationId);

  const { variants, ...propertyData } = data;

  return withUniqueRetry(() =>
    prisma.$transaction(async (tx) => {
      const property = await tx.property.create({
        data: {
          ...propertyData,
          propertyCode: generatePropertyCode(),
          slug: generateUniqueSlug(propertyData.title),
          sellerId,
          amenities: propertyData.amenities ?? [],
          nearbyPlaces: propertyData.nearbyPlaces ?? [],
          societyInfo: propertyData.societyInfo ?? {},
        },
        select: { id: true },
      });

      await tx.propertyVariant.createMany({
        data: variants.map((v) => ({
          ...v,
          propertyId: property.id,
          variantCode: generateVariantCode(),
        })),
      });

      return tx.property.findUnique({
        where: { id: property.id },
        select: propertyDetailSelect,
      });
    })
  );
};

const listPublicProperties = async (query: ListQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const variantFilter: Record<string, unknown> = {};
  const priceFilter: Record<string, unknown> = {};
  if (query.minPrice !== undefined) priceFilter.gte = query.minPrice;
  if (query.maxPrice !== undefined) priceFilter.lte = query.maxPrice;
  if (Object.keys(priceFilter).length > 0) variantFilter.price = priceFilter;
  if (query.bedrooms !== undefined) variantFilter.bedrooms = query.bedrooms;
  if (query.furnishingStatus) variantFilter.furnishingStatus = query.furnishingStatus;
  if (query.availabilityStatus) variantFilter.availabilityStatus = query.availabilityStatus;

  const where: Record<string, unknown> = {
    deletedAt: null,
    isActive: true,
    propertyStatus: {
      notIn: [PropertyStatus.DRAFT, PropertyStatus.WITHDRAWN],
    },
  };

  if (query.transactionType) where.transactionType = query.transactionType;
  if (query.propertyType) where.propertyType = query.propertyType;
  if (query.propertyStatus) where.propertyStatus = query.propertyStatus;
  if (query.city) where.city = { equals: query.city, mode: "insensitive" };
  if (query.state) where.state = { equals: query.state, mode: "insensitive" };
  if (query.pincode) where.pincode = { contains: query.pincode };
  if (query.isFeatured) where.isFeatured = query.isFeatured === "true";
  if (query.q) where.title = { contains: query.q, mode: "insensitive" };
  if (query.sellerSlug) where.seller = { slug: query.sellerSlug };
  if (Object.keys(variantFilter).length > 0) {
    where.variants = { some: variantFilter };
  }

  let orderBy: Record<string, unknown> | Record<string, unknown>[] = {
    createdAt: "desc",
  };

  switch (query.sort) {
    case "price_asc":
      orderBy = { variants: { _min: { price: "asc" } } };
      break;
    case "price_desc":
      orderBy = { variants: { _min: { price: "desc" } } };
      break;
    case "popular":
      orderBy = [{ viewsCount: "desc" }, { createdAt: "desc" }];
      break;
  }

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      skip,
      take,
      orderBy,
      select: propertyCardSelect,
    }),
    prisma.property.count({ where }),
  ]);

  return buildPaginatedResponse(
    properties.map(toCard),
    total,
    page,
    limit
  );
};

const getPublicProperty = async (slug: string, viewerId?: string) => {
  const property = await prisma.property.findFirst({
    where: {
      slug,
      deletedAt: null,
      isActive: true,
      propertyStatus: {
        notIn: [PropertyStatus.DRAFT, PropertyStatus.WITHDRAWN],
      },
    },
    select: propertyDetailSelect,
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  await prisma.property
    .update({
      where: { id: property.id },
      data: { viewsCount: { increment: 1 } },
    })
    .catch(() => {});

  let isLiked = false;
  if (viewerId) {
    const like = await prisma.propertyLike.findUnique({
      where: {
        userId_propertyId: { userId: viewerId, propertyId: property.id },
      },
      select: { id: true },
    });
    isLiked = Boolean(like);
  }

  return { ...property, viewsCount: property.viewsCount + 1, isLiked };
};

const getMyProperties = async (
  sellerId: string,
  query: { page?: number; limit?: number; propertyStatus?: string }
) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where: Record<string, unknown> = { sellerId, deletedAt: null };
  if (query.propertyStatus) where.propertyStatus = query.propertyStatus;

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: propertyCardSelect,
    }),
    prisma.property.count({ where }),
  ]);

  return buildPaginatedResponse(
    properties.map(toCard),
    total,
    page,
    limit
  );
};

const getMyProperty = async (sellerId: string, propertyId: string) => {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, sellerId, deletedAt: null },
    select: propertyDetailSelect,
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  return property;
};

const updateProperty = async (
  sellerId: string,
  propertyId: string,
  data: UpdatePropertyInput
) => {
  const property = await ensureOwnProperty(sellerId, propertyId);
  await ensureOrgOwnership(sellerId, data.organizationId);

  const { variants: _variants, ...updateData } = data;
  const updatePayload: Record<string, unknown> = { ...updateData };

  if (updatePayload.title && updatePayload.title !== property.title) {
    updatePayload.slug = generateUniqueSlug(String(updatePayload.title));
  }

  try {
    return await prisma.property.update({
      where: { id: property.id },
      data: updatePayload,
      select: propertyDetailSelect,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ApiError(409, "Slug is already in use");
    }
    throw err;
  }
};

const updatePropertyStatus = async (
  sellerId: string,
  propertyId: string,
  propertyStatus: string
) => {
  const property = await ensureOwnProperty(sellerId, propertyId);

  return prisma.property.update({
    where: { id: property.id },
    data: { propertyStatus: propertyStatus as PropertyStatus },
    select: propertyDetailSelect,
  });
};

const softDeleteProperty = async (sellerId: string, propertyId: string) => {
  const property = await ensureOwnProperty(sellerId, propertyId);

  return prisma.property.update({
    where: { id: property.id },
    data: { deletedAt: new Date() },
    select: { id: true, deletedAt: true },
  });
};

const addImages = async (
  sellerId: string,
  propertyId: string,
  files: Express.Multer.File[]
) => {
  const property = await findOwnPropertyWithImages(sellerId, propertyId);
  const urls = await processPropertyImages(files);

  const current = asImageList(property.images);
  const isFirst = current.length === 0;
  const additions = urls.map((url, idx) => ({
    url,
    isFeatured: isFirst && idx === 0,
  }));

  const updated = [...current, ...additions];

  return prisma.property.update({
    where: { id: property.id },
    data: { images: updated },
    select: propertyDetailSelect,
  });
};

const setImageOrder = async (
  sellerId: string,
  propertyId: string,
  images: { url: string; isFeatured?: boolean }[]
) => {
  const property = await ensureOwnProperty(sellerId, propertyId);

  return prisma.property.update({
    where: { id: property.id },
    data: { images },
    select: propertyDetailSelect,
  });
};

const removeImage = async (sellerId: string, propertyId: string, url: string) => {
  const property = await findOwnPropertyWithImages(sellerId, propertyId);
  const current = asImageList(property.images);

  const updated = current.filter((img) => img.url !== url);

  if (current.length !== updated.length && url.startsWith("/uploads/")) {
    await fs.unlink(path.join(process.cwd(), url)).catch(() => {});
  }

  return prisma.property.update({
    where: { id: property.id },
    data: { images: updated },
    select: propertyDetailSelect,
  });
};

const addVariant = async (
  sellerId: string,
  propertyId: string,
  data: CreateVariantInput
) => {
  const property = await ensureOwnProperty(sellerId, propertyId);

  try {
    return await prisma.propertyVariant.create({
      data: { ...data, propertyId: property.id, variantCode: generateVariantCode() },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ApiError(409, "A variant with this name already exists");
    }
    throw err;
  }
};

const updateVariant = async (
  sellerId: string,
  propertyId: string,
  variantId: string,
  data: UpdateVariantInput
) => {
  const variant = await ensureOwnVariant(sellerId, propertyId, variantId);

  return prisma.propertyVariant.update({
    where: { id: variant.id },
    data,
  });
};

const deleteVariant = async (
  sellerId: string,
  propertyId: string,
  variantId: string
) => {
  const variant = await ensureOwnVariant(sellerId, propertyId, variantId);

  await prisma.propertyVariant.delete({ where: { id: variant.id } });

  return { message: "Variant deleted" };
};

const addVariantImages = async (
  sellerId: string,
  propertyId: string,
  variantId: string,
  files: Express.Multer.File[]
) => {
  const variant = await ensureOwnVariant(sellerId, propertyId, variantId, {
    id: true,
    images: true,
  });

  const urls = await processPropertyImages(files);
  const current: { url: string }[] = (variant.images as { url: string }[]) || [];
  const updated = [...current, ...urls.map((url) => ({ url }))];

  return prisma.propertyVariant.update({
    where: { id: variant.id },
    data: { images: updated },
  });
};

const adminListProperties = async (
  query: {
    page?: number;
    limit?: number;
    propertyStatus?: string;
    isVerified?: string;
    isActive?: string;
    includeDeleted?: string;
  }
) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where: Record<string, unknown> = {};
  if (query.includeDeleted !== "true") where.deletedAt = null;
  if (query.propertyStatus) where.propertyStatus = query.propertyStatus;
  if (query.isVerified) where.isVerified = query.isVerified === "true";
  if (query.isActive) where.isActive = query.isActive === "true";

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: propertyCardSelect,
    }),
    prisma.property.count({ where }),
  ]);

  return buildPaginatedResponse(properties.map(toCard), total, page, limit);
};

const verifyProperty = async (
  adminId: string,
  propertyId: string,
  isVerified: boolean
) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  return prisma.property.update({
    where: { id: propertyId },
    data: {
      isVerified,
      verifiedBy: isVerified ? adminId : null,
      verifiedAt: isVerified ? new Date() : null,
    },
    select: propertyDetailSelect,
  });
};

const togglePropertyActive = async (
  _adminId: string,
  propertyId: string,
  isActive: boolean
) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  return prisma.property.update({
    where: { id: propertyId },
    data: { isActive },
    select: propertyDetailSelect,
  });
};

export {
  createProperty,
  listPublicProperties,
  getPublicProperty,
  getMyProperties,
  getMyProperty,
  updateProperty,
  updatePropertyStatus,
  softDeleteProperty,
  addImages,
  setImageOrder,
  removeImage,
  addVariant,
  updateVariant,
  deleteVariant,
  addVariantImages,
  adminListProperties,
  verifyProperty,
  togglePropertyActive,
};
