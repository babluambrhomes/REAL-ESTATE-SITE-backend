import {
  propertyCardSelect,
  propertyDetailSelect,
  toCard,
  asImageList,
  PUBLIC_PROPERTY_STATUSES,
} from "./property.select";

import path from "path";
import fs from "fs/promises";
import slugify from "slugify";
import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import {
  getPaginationParams,
  buildPagination,
  generateTimestampSuffix,
  isUniqueViolation,
  withUniqueRetry,
  ownedPropertyWhere,
  ownedPropertyRelation,
  assertRequestedOrgMatchesContext,
} from "../../helpers";
import { processImage } from "../../workers/image/imageWorker.pool";
import { uploadFile, deleteCloudinaryFile, isCloudinaryUrl } from "../../helpers/cloudinary.helper";
import { PropertyStatus, ListingStatus, VerificationStatus } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import { SellerContext } from "../../types";
import {
  CreatePropertyInput,
  UpdatePropertyInput,
  CreateVariantInput,
  UpdateVariantInput,
  ListQueryInput,
} from "./property.validation";

const generatePropertyCode = (): string => `PROP-${generateTimestampSuffix()}`;

const generateVariantCode = (): string => `VRT-${generateTimestampSuffix()}`;

const generateUniqueSlug = (title: string): string => {
  const base = slugify(title, { lower: true, strict: true }) || "property";
  return `${base}-${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
};

/**
 * Loads a property the acting context is allowed to manage.
 *
 * Throws 404 rather than 403 when the property exists but belongs to
 * someone else: telling an attacker "this ID exists but is not yours"
 * turns the endpoint into an ID oracle for the whole listing table.
 */
const ensureOwnProperty = async (ctx: SellerContext, propertyId: string) => {
  const property = await prisma.property.findFirst({
    where: { ...ownedPropertyWhere(ctx), id: propertyId },
    select: {
      id: true,
      title: true,
      userId: true,
      organizationId: true,
      listingStatus: true,
    },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  return property;
};

const findOwnPropertyWithImages = async (ctx: SellerContext, propertyId: string) => {
  const property = await prisma.property.findFirst({
    where: { ...ownedPropertyWhere(ctx), id: propertyId },
    select: { id: true, images: true },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  return property;
};

const ensureOwnVariant = async (
  ctx: SellerContext,
  propertyId: string,
  variantId: string,
  select?: { id?: boolean; images?: boolean }
) => {
  const variant = await prisma.propertyVariant.findFirst({
    where: {
      id: variantId,
      property: ownedPropertyRelation(ctx),
      ...propertyId ? { propertyId } : {},
    },
    select: select ?? { id: true },
  });

  if (!variant) {
    throw new ApiError(404, "Variant not found");
  }

  return variant;
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

    // --- CLOUDINARY (new) ---
    const uploaded = await uploadFile(result.outputs[0], {
      folder: `${process.env.CLOUDINARY_FOLDER || "real-estate"}/properties/images`,
      resourceType: "image",
    });
    urls.push(uploaded.url);

    // --- LOCAL (old) -- keep for reference ---
    // const relPath = path
    //   .relative(parsed.dir, result.outputs[0])
    //   .split(path.sep)
    //   .join("/");
    // urls.push(`/uploads/${relPath}`);
  }

  return urls;
};

const createProperty = async (ctx: SellerContext, data: CreatePropertyInput) => {
  // `organizationId` in the body only SELECTS the acting context; the
  // value actually stored always comes from the resolved context, so a
  // caller cannot attribute a listing to a company they do not belong to.
  assertRequestedOrgMatchesContext(ctx, data.organizationId);

  const { variants, organizationId: _requestedOrg, ...propertyData } = data;

  const createData: Prisma.PropertyUncheckedCreateInput = {
    title: propertyData.title,
    description: propertyData.description,
    transactionType: propertyData.transactionType,
    propertyType: propertyData.propertyType ?? "APARTMENT",
    propertyStatus: propertyData.propertyStatus ?? PropertyStatus.AVAILABLE,
    addressLine: propertyData.addressLine,
    city: propertyData.city,
    state: propertyData.state,
    country: propertyData.country,
    pincode: propertyData.pincode,
    latitude: propertyData.latitude,
    longitude: propertyData.longitude,
    googleMapLink: propertyData.googleMapLink,
    ownershipType: propertyData.ownershipType,
    listedBy: propertyData.listedBy,
    ageOfProperty: propertyData.ageOfProperty,
    reraNumber: propertyData.reraNumber,
    registrationNumber: propertyData.registrationNumber,
    taxAssessment: propertyData.taxAssessment,
    encumbrance: propertyData.encumbrance,
    contactName: propertyData.contactName,
    contactPhone: propertyData.contactPhone,
    contactEmail: propertyData.contactEmail,
    metaTitle: propertyData.metaTitle,
    metaDescription: propertyData.metaDescription,
    metaKeywords: propertyData.metaKeywords,
    propertyCode: generatePropertyCode(),
    slug: generateUniqueSlug(propertyData.title),
    // Ownership: creator + whichever organization (if any) they are
    // acting through. Both are set for org members.
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    // New listings start unpublished. Publishing is a separate,
    // permission-gated transition so a seller cannot self-publish
    // something that has not been reviewed.
    listingStatus: ListingStatus.DRAFT,
    verificationStatus: VerificationStatus.PENDING,
    amenities: propertyData.amenities ?? [],
    nearbyPlaces: propertyData.nearbyPlaces ?? [],
    societyInfo: propertyData.societyInfo ?? {},
  };

  return withUniqueRetry(() =>
    prisma.$transaction(async (tx) => {
      const property = await tx.property.create({
        data: createData,
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
    // Public visibility is an ALLOWLIST, not a denylist.
    //
    // Written as `in: PUBLIC_PROPERTY_STATUSES` rather than
    // `notIn: [DRAFT, WITHDRAWN]` on purpose: a new PropertyStatus added to
    // the enum later (RESERVED, coming-soon, anything) becomes visible to
    // every visitor by default with the denylist form. With the allowlist it
    // stays hidden until someone decides it is public.
    //
    // It also mirrors properties_public_search_idx, which is a partial index
    // on listing_status = 'PUBLISHED' AND property_status IN
    // ('AVAILABLE','UNDER_OFFER'). The index is on listing_status and
    // created_at; a broader predicate would simply fall back to a seq scan
    // for no benefit, since published listings are overwhelmingly AVAILABLE.
    listingStatus: ListingStatus.PUBLISHED,
    propertyStatus: { in: PUBLIC_PROPERTY_STATUSES },
  };

  if (query.transactionType) where.transactionType = query.transactionType;
  if (query.propertyType) where.propertyType = query.propertyType;
  if (query.propertyStatus) {
    // Narrowing to a non-public status must not widen visibility, so a
    // requested status has to be on the public allowlist to replace it.
    if (PUBLIC_PROPERTY_STATUSES.includes(query.propertyStatus)) {
      where.propertyStatus = query.propertyStatus;
    }
  }
  if (query.city) where.city = { equals: query.city, mode: "insensitive" };
  if (query.state) where.state = { equals: query.state, mode: "insensitive" };
  if (query.pincode) where.pincode = { contains: query.pincode };
  if (query.isFeatured) where.isFeatured = query.isFeatured === "true";
  if (query.q) where.title = { contains: query.q, mode: "insensitive" };
  if (query.sellerSlug) {
    // SellerProfile is no longer reachable from Property directly, so a
    // seller page is "either my profile or my organization's profile".
    where.OR = [
      { user: { sellerProfile: { slug: query.sellerSlug } } },
      { organization: { sellerProfile: { slug: query.sellerSlug } } },
    ];
  }
  if (Object.keys(variantFilter).length > 0) {
    // Variant filter sirf ACTIVE variants pe lagna chahiye — warna inactive
    // variant filter-eligible property la dega (sort MIN(price) se mismatch).
    variantFilter.isActive = true;
    where.variants = { some: variantFilter };
  }

  let orderBy: Record<string, unknown> | Record<string, unknown>[] = {
    createdAt: "desc",
  };

  switch (query.sort) {
    // --- OLD (comment): Prisma to-many relation orderBy me sirf `_count` hota hai,
    // `_min`/`_max` support nahi -> PrismaClientValidationError.
    // case "price_asc":
    //   orderBy = { variants: { _min: { price: "asc" } } };
    //   break;
    // case "price_desc":
    //   orderBy = { variants: { _min: { price: "desc" } } };
    //   break;
    case "popular":
      orderBy = [{ viewsCount: "desc" }, { createdAt: "desc" }];
      break;
  }

  // --- RAW PRICE SORT (new) ---
  // Prisma relation orderBy me min price sort nahi ho sakta (sirf _count),
  // isliye price_asc/price_desc ke liye raw SQL use hota hai —
  // same filters + pagination, MIN(active variant price) se order.
  if (query.sort === "price_asc" || query.sort === "price_desc") {
    const direction = query.sort === "price_asc" ? "ASC" : "DESC";

    const clauses: string[] = [
      // MUST mirror the Prisma `where` above — this raw path only re-orders
      // ids, and the Prisma fetch after it re-filters with the real `where`.
      // If these two ever drift the symptom is "pagination is wrong on
      // price sort only", which is a miserable bug to track down.
      //
      // The status list is interpolated from PUBLIC_PROPERTY_STATUSES rather
      // than written out here, so the raw path cannot drift from the Prisma
      // path. The values are enum members, never user input.
      'p."listing_status" = \'PUBLISHED\'',
      // Interpolated, not parameterised: these are enum members fixed at
      // compile time, never user input.
      `p."property_status" IN (${PUBLIC_PROPERTY_STATUSES.map(
        (s) => `'${s}'`
      ).join(", ")})`,
    ];
    const params: unknown[] = [];

    const add = (sql: (n: number) => string, value: unknown) => {
      if (value !== undefined && value !== null) {
        params.push(value);
        clauses.push(sql(params.length));
      }
    };

    add((n) => `p."transaction_type" = $${n}`, query.transactionType);
    add((n) => `p."property_type" = $${n}`, query.propertyType);
    add(
      (n) => `p."property_status" = $${n}`,
      // Same allowlist as the Prisma path — a caller asking for DRAFT must
      // not be able to pull unpublished rows into the ordering pass.
      query.propertyStatus &&
        PUBLIC_PROPERTY_STATUSES.includes(query.propertyStatus)
        ? query.propertyStatus
        : null
    );
    add((n) => `p."city" ILIKE $${n}`, query.city);
    add((n) => `p."state" ILIKE $${n}`, query.state);
    add((n) => `p."pincode" LIKE '%' || $${n} || '%'`, query.pincode);
    add(
      (n) => `p."is_featured" = $${n}`,
      query.isFeatured === undefined ? null : query.isFeatured === "true"
    );
    add((n) => `p."title" ILIKE '%' || $${n} || '%'`, query.q);
    add(
      (n) =>
        `EXISTS (SELECT 1 FROM "seller_profiles" sp
          LEFT JOIN "organizations" o ON o."id" = sp."organization_id"
          WHERE sp."slug" = $${n}
            AND (sp."user_id" = p."user_id" OR o."id" = p."organization_id"))`,
      query.sellerSlug
    );

    const variantClauses: string[] = [];
    const addVariant = (sql: (n: number) => string, value: unknown) => {
      if (value !== undefined && value !== null) {
        params.push(value);
        variantClauses.push(sql(params.length));
      }
    };

    addVariant((n) => `vv."price" >= $${n}`, query.minPrice);
    addVariant((n) => `vv."price" <= $${n}`, query.maxPrice);
    addVariant((n) => `vv."bedrooms" = $${n}`, query.bedrooms);
    addVariant((n) => `vv."furnishing_status" = $${n}`, query.furnishingStatus);
    addVariant((n) => `vv."construction_status" = $${n}`, query.availabilityStatus);

    if (variantClauses.length > 0) {
      clauses.push(
        `EXISTS (SELECT 1 FROM "property_variants" vv WHERE vv."property_id" = p."id" AND vv."is_active" = true AND ${variantClauses.join(
          " AND "
        )})`
      );
    }

    const takeIndex = params.length + 1;
    const skipIndex = params.length + 2;
    params.push(take, skip);

    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `
      SELECT p."id"
      FROM "properties" p
      LEFT JOIN "property_variants" v
        ON v."property_id" = p."id" AND v."is_active" = true
      WHERE ${clauses.join(" AND ")}
      GROUP BY p."id"
      ORDER BY MIN(v."price") ${direction} NULLS LAST, p."created_at" DESC
      LIMIT $${takeIndex} OFFSET $${skipIndex};
      `,
      ...params
    );

    const orderedIds = rows.map((r) => r.id);

    const [matched, total] = await Promise.all([
      orderedIds.length > 0
        ? prisma.property.findMany({
            where: { ...where, id: { in: orderedIds } },
            select: propertyCardSelect,
          })
        : Promise.resolve([]),
      prisma.property.count({ where }),
    ]);

    const byId = new Map<string, (typeof matched)[number]>(
      matched.map((p) => [p.id, p])
    );
    const sortedProperties = orderedIds
      .map((id) => byId.get(id))
      .filter((p): p is (typeof matched)[number] => Boolean(p));

    return {
      data: sortedProperties.map(toCard),
      ...buildPagination(total, page, limit),
    };
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

  return {
    data: properties.map(toCard),
    ...buildPagination(total, page, limit),
  };
};

const getPublicProperty = async (slug: string, viewerId?: string) => {
  const property = await prisma.property.findFirst({
    where: {
      slug,
      // Same public allowlist as list and search — a detail page must not be
      // a way around the list filter to reach a withdrawn or draft listing.
      listingStatus: ListingStatus.PUBLISHED,
      propertyStatus: { in: PUBLIC_PROPERTY_STATUSES },
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
  ctx: SellerContext,
  query: {
    page?: number;
    limit?: number;
    propertyStatus?: string;
    listingStatus?: string;
    includeDeleted?: string;
  }
) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  // "My listings" includes PAUSED and DRAFT — the seller needs to see and
  // edit them. DELETED stays hidden unless explicitly asked for.
  const where: Record<string, unknown> =
    query.includeDeleted === "true"
      ? ctx.organizationId
        ? { organizationId: ctx.organizationId }
        : { userId: ctx.userId, organizationId: null }
      : ownedPropertyWhere(ctx);

  if (query.propertyStatus) where.propertyStatus = query.propertyStatus;
  if (query.listingStatus) where.listingStatus = query.listingStatus;

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

  return {
    data: properties.map(toCard),
    ...buildPagination(total, page, limit),
  };
};

const getMyProperty = async (ctx: SellerContext, propertyId: string) => {
  const property = await prisma.property.findFirst({
    where: { ...ownedPropertyWhere(ctx), id: propertyId },
    select: propertyDetailSelect,
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  return property;
};

const updateProperty = async (
  ctx: SellerContext,
  propertyId: string,
  data: UpdatePropertyInput
) => {
  const property = await ensureOwnProperty(ctx, propertyId);
  assertRequestedOrgMatchesContext(ctx, data.organizationId);

  const { variants: _variants, organizationId: _requestedOrg, ...updateData } = data;
  const updatePayload: Record<string, unknown> = { ...updateData };

  // Ownership columns are immutable after creation. Re-parenting a
  // listing between users/organizations would silently transfer editing
  // rights and orphan any open leads attached to it, so it is rejected
  // rather than supported.
  delete updatePayload.userId;
  delete updatePayload.organizationId;

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
  ctx: SellerContext,
  propertyId: string,
  propertyStatus: string
) => {
  const property = await ensureOwnProperty(ctx, propertyId);

  return prisma.property.update({
    where: { id: property.id },
    data: { propertyStatus: propertyStatus as PropertyStatus },
    select: propertyDetailSelect,
  });
};

/**
 * Soft delete. The row is never physically removed — `listingStatus`
 * becomes DELETED, which every query filters out.
 */
const softDeleteProperty = async (ctx: SellerContext, propertyId: string) => {
  const property = await ensureOwnProperty(ctx, propertyId);

  return prisma.property.update({
    where: { id: property.id },
    data: { listingStatus: ListingStatus.DELETED },
    select: { id: true, listingStatus: true },
  });
};

const addImages = async (
  ctx: SellerContext,
  propertyId: string,
  files: Express.Multer.File[]
) => {
  const property = await findOwnPropertyWithImages(ctx, propertyId);
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
  ctx: SellerContext,
  propertyId: string,
  images: { url: string; isFeatured?: boolean }[]
) => {
  const property = await ensureOwnProperty(ctx, propertyId);

  return prisma.property.update({
    where: { id: property.id },
    data: { images },
    select: propertyDetailSelect,
  });
};

const removeImage = async (ctx: SellerContext, propertyId: string, url: string) => {
  const property = await findOwnPropertyWithImages(ctx, propertyId);
  const current = asImageList(property.images);

  const updated = current.filter((img) => img.url !== url);

  if (current.length !== updated.length) {
    // --- CLOUDINARY (new) ---
    if (isCloudinaryUrl(url)) {
      await deleteCloudinaryFile(url);
    }

    // --- LOCAL (old) -- keep for reference ---
    // if (url.startsWith("/uploads/")) {
    //   await fs.unlink(path.join(process.cwd(), url)).catch(() => {});
    // }
  }

  return prisma.property.update({
    where: { id: property.id },
    data: { images: updated },
    select: propertyDetailSelect,
  });
};

const addVariant = async (
  ctx: SellerContext,
  propertyId: string,
  data: CreateVariantInput
) => {
  const property = await ensureOwnProperty(ctx, propertyId);

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
  ctx: SellerContext,
  propertyId: string,
  variantId: string,
  data: UpdateVariantInput
) => {
  const variant = await ensureOwnVariant(ctx, propertyId, variantId);

  return prisma.propertyVariant.update({
    where: { id: variant.id },
    data,
  });
};

const deleteVariant = async (
  ctx: SellerContext,
  propertyId: string,
  variantId: string
) => {
  const variant = await ensureOwnVariant(ctx, propertyId, variantId);

  await prisma.propertyVariant.delete({ where: { id: variant.id } });

  return { message: "Variant deleted" };
};

const addVariantImages = async (
  ctx: SellerContext,
  propertyId: string,
  variantId: string,
  files: Express.Multer.File[]
) => {
  const variant = await ensureOwnVariant(ctx, propertyId, variantId, {
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
    listingStatus?: string;
    verificationStatus?: string;
    organizationId?: string;
    userId?: string;
  }
) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where: Record<string, unknown> = {};
  if (query.propertyStatus) where.propertyStatus = query.propertyStatus;
  if (query.listingStatus) where.listingStatus = query.listingStatus;
  if (query.verificationStatus) where.verificationStatus = query.verificationStatus;
  if (query.organizationId) where.organizationId = query.organizationId;
  if (query.userId) where.userId = query.userId;

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

  return {
    data: properties.map(toCard),
    ...buildPagination(total, page, limit),
  };
};

/**
 * Sets a property's verification state.
 *
 * Verified / Rejected is a platform judgement about a listing, so the
 * approver is recorded (verifiedBy) only on the positive outcome —
 * keeping the reviewer identity alongside the verdict makes disputes
 * auditable.
 */
const verifyProperty = async (
  adminId: string,
  propertyId: string,
  verificationStatus: VerificationStatus
) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  const isVerified = verificationStatus === VerificationStatus.VERIFIED;

  return prisma.property.update({
    where: { id: propertyId },
    data: {
      verificationStatus,
      verifiedBy: isVerified ? adminId : null,
      verifiedAt: isVerified ? new Date() : null,
    },
    select: propertyDetailSelect,
  });
};

/**
 * Admin listing-visibility control. Replaces the old `isActive` toggle.
 */
const setPropertyListingStatus = async (
  _adminId: string,
  propertyId: string,
  listingStatus: ListingStatus
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
    data: { listingStatus },
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
  setPropertyListingStatus,
  PUBLIC_PROPERTY_STATUSES,
};
