import { Prisma } from "../../generated/prisma/client";
import prisma from "../../config/prisma";
import { getPaginationParams, buildPagination, buildCacheKey, withCache, getCacheVersion } from "../../helpers";
import { SearchQueryInput } from "./search.validation";
import type { SearchResponse, SearchMeta } from "./search.types";

// ============================================================
// Helpers
// ============================================================

const sanitizeSearchQuery = (q: string): string => {
  return q
       .replace(/[!|&():*"'[\]\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const escapeLikeWildcard = (input: string): string => {
   return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
};

interface BoundingBox {
  southWestLat: number;
  southWestLng: number;
  northEastLat: number;
  northEastLng: number;
}

const parseBounds = (bounds: string): BoundingBox | null => {
  const parts = bounds.split(",").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  const [lat1, lng1, lat2, lng2] = parts;
  return {
    southWestLat: Math.min(lat1, lat2),
    southWestLng: Math.min(lng1, lng2),
    northEastLat: Math.max(lat1, lat2),
    northEastLng: Math.max(lng1, lng2),
  };
};

// ============================================================
// Main Search Function (cached)
// ============================================================
const searchProperties = async (
  query: SearchQueryInput
): Promise<SearchResponse> => {
  const { page = 1 } = query;

  const cacheVersion = await getCacheVersion();
  const cacheKey = buildCacheKey("search:v1", { ...query, v: cacheVersion });

  // TTL: page 1 = 60s, page 2+ = 30s
  const ttl = page === 1 ? 60 : 30;

  return withCache(cacheKey, () => executeSearch(query), { ttl });
};

// ============================================================
// Actual Search Execution
// ============================================================
const executeSearch = async (
  query: SearchQueryInput
): Promise<SearchResponse> => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const hasLocation = query.lat !== undefined && query.lng !== undefined;
  const hasText = Boolean(query.q && query.q.trim().length > 0);
  const hasBounds = Boolean(query.bounds);
  const radiusMeters = query.radiusKm ? query.radiusKm * 1000 : 5000;

  // Sanitize search query to prevent costly tsquery attacks
  const sanitizedQ = hasText ? sanitizeSearchQuery(query.q!.trim()) : "";
  const safeHasText = sanitizedQ.length > 0;

  // --- Build dynamic WHERE conditions ---
  const conditions: Prisma.Sql[] = [];

  // Base filters (always active)
  conditions.push(Prisma.sql`p."is_active" = true`);
  conditions.push(Prisma.sql`p."deleted_at" IS NULL`);
  // Public search only exposes available / under-offer listings
  conditions.push(Prisma.sql`p."property_status" IN ('AVAILABLE', 'UNDER_OFFER')`);

  // --- Text search via tsvector ---
  if (safeHasText) {
    conditions.push(
      Prisma.sql`p."searchVector" @@ websearch_to_tsquery('english', ${sanitizedQ})`
    );
  }

  // --- Location: Radius search via PostGIS ---
  if (hasLocation && !hasBounds) {
    conditions.push(
      Prisma.sql`ST_DWithin(p."geog", ST_SetSRID(ST_MakePoint(${query.lng!}, ${query.lat!}), 4326)::geography, ${radiusMeters})`
    );
  }

  // --- Location: Bounding box search via PostGIS ---
  if (hasBounds) {
    const box = parseBounds(query.bounds!);
    if (box) {
      conditions.push(
        Prisma.sql`ST_Intersects(
          p."geog"::geometry,
          ST_MakeEnvelope(${box.southWestLng}, ${box.southWestLat}, ${box.northEastLng}, ${box.northEastLat}, 4326)
        )`
      );
    }
  }

  // --- Property filters ---
  if (query.transactionType) {
    conditions.push(Prisma.sql`p."transaction_type" = ${query.transactionType}`);
  }
  if (query.propertyType) {
    conditions.push(Prisma.sql`p."property_type" = ${query.propertyType}`);
  }
  if (query.propertyStatus) {
    conditions.push(Prisma.sql`p."property_status" = ${query.propertyStatus}`);
  }
  if (query.city) {
    conditions.push(Prisma.sql`LOWER(p."city") = LOWER(${query.city})`);
  }
  if (query.state) {
    conditions.push(Prisma.sql`LOWER(p."state") = LOWER(${query.state})`);
  }
  if (query.pincode) {
    const escaped = escapeLikeWildcard(query.pincode);
    conditions.push(Prisma.sql`p."pincode" ILIKE ${"%" + escaped + "%"}`);
  }
  if (query.ownershipType) {
    conditions.push(Prisma.sql`p."ownership_type" = ${query.ownershipType}`);
  }
  if (query.listedBy) {
    conditions.push(Prisma.sql`p."listed_by" = ${query.listedBy}`);
  }
  if (query.isFeatured !== undefined) {
    conditions.push(Prisma.sql`p."is_featured" = ${query.isFeatured === "true"}`);
  }
  if (query.isVerified !== undefined) {
    conditions.push(Prisma.sql`p."is_verified" = ${query.isVerified === "true"}`);
  }
  if (query.sellerSlug) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "seller_profiles" sp
        WHERE sp."id" = p."seller_id" AND sp."slug" = ${query.sellerSlug}
      )`
    );
  }

  // --- Variant filters (used by LATERAL selection AND count EXISTS) ---
  const variantConditions: Prisma.Sql[] = [Prisma.sql`pv."is_active" = true`];

  if (query.minPrice !== undefined) {
    variantConditions.push(Prisma.sql`pv."price" >= ${query.minPrice}`);
  }
  if (query.maxPrice !== undefined) {
    variantConditions.push(Prisma.sql`pv."price" <= ${query.maxPrice}`);
  }
  const bhkValue = query.bhk !== undefined ? Number(query.bhk) : query.bedrooms;
  if (bhkValue !== undefined && !isNaN(bhkValue) && Number.isInteger(bhkValue)) {
    variantConditions.push(Prisma.sql`pv."bedrooms" = ${bhkValue}`);
  }
  if (query.bathrooms !== undefined) {
    variantConditions.push(Prisma.sql`pv."bathrooms" = ${query.bathrooms}`);
  }
  if (query.furnishingStatus) {
    variantConditions.push(Prisma.sql`pv."furnishing_status" = ${query.furnishingStatus}`);
  }
  if (query.availabilityStatus) {
    variantConditions.push(Prisma.sql`pv."construction_status" = ${query.availabilityStatus}`);
  }

  const variantWhere = Prisma.join(variantConditions, " AND ");

  // --- Combine all property-level conditions ---
  const whereClause = Prisma.join(conditions, " AND ");

  const sort = query.sort || (safeHasText ? "relevance" : hasLocation ? "distance" : "newest");

  // Mehngi computations pre-LIMIT sirf tab, jab wo ORDER BY sort key hon
  const needRankPreLimit = safeHasText && sort === "relevance";
  const needDistancePreLimit = hasLocation && (sort === "distance" || (sort === "relevance" && safeHasText));

  const rankInnerExpr: Prisma.Sql = needRankPreLimit
    ? Prisma.sql`ts_rank(p."searchVector", websearch_to_tsquery('english', ${sanitizedQ}), 1)::float8 AS "textRank"`
    : Prisma.sql`NULL::float8 AS "textRank"`;

  const distanceInnerExpr: Prisma.Sql = needDistancePreLimit
    ? Prisma.sql`ST_Distance(p."geog", ST_SetSRID(ST_MakePoint(${query.lng!}, ${query.lat!}), 4326)::geography)::float8 AS "distanceMeters"`
    : Prisma.sql`NULL::float8 AS "distanceMeters"`;

  const rankOuterExpr: Prisma.Sql = needRankPreLimit
    ? Prisma.sql`s."textRank" AS "textRank"`
    : safeHasText
      ? Prisma.sql`ts_rank(po."searchVector", websearch_to_tsquery('english', ${sanitizedQ}), 1)::float8 AS "textRank"`
      : Prisma.sql`NULL::float8 AS "textRank"`;

  const distanceOuterExpr: Prisma.Sql = needDistancePreLimit
    ? Prisma.sql`s."distanceMeters" AS "distanceMeters"`
    : hasLocation
      ? Prisma.sql`ST_Distance(po."geog", ST_SetSRID(ST_MakePoint(${query.lng!}, ${query.lat!}), 4326)::geography)::float8 AS "distanceMeters"`
      : Prisma.sql`NULL::float8 AS "distanceMeters"`;

  const snippetExpr: Prisma.Sql = safeHasText
    ? Prisma.sql`ts_headline('english', coalesce(left(po."description", 2000), ''), websearch_to_tsquery('english', ${sanitizedQ}), 'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=10') AS "snippet"`
    : Prisma.sql`NULL::text AS "snippet"`;

  // --- Build ORDER BY (genuine sort on the LATERAL-selected variant, applied inside subquery) ---
  let orderBy: Prisma.Sql;

  switch (sort) {
    case "relevance":
      orderBy = safeHasText
        ? Prisma.sql`"textRank" DESC, "distanceMeters" ASC NULLS LAST, p."created_at" DESC`
        : Prisma.sql`p."created_at" DESC`;
      break;
    case "distance":
      orderBy = hasLocation
        ? Prisma.sql`"distanceMeters" ASC NULLS LAST, p."created_at" DESC`
        : Prisma.sql`p."created_at" DESC`;
      break;
    case "price_asc":
      orderBy = Prisma.sql`pv."price" ASC NULLS LAST, p."created_at" DESC`;
      break;
    case "price_desc":
      orderBy = Prisma.sql`pv."price" DESC NULLS LAST, p."created_at" DESC`;
      break;
    case "popular":
      orderBy = Prisma.sql`p."views_count" DESC, p."likes_count" DESC`;
      break;
    default:
      orderBy = Prisma.sql`p."created_at" DESC`;
  }

  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        s."id",
        s."propertyCode",
        s."title",
        s."slug",
        s."transactionType",
        s."propertyType",
        s."propertyStatus",
        s."city",
        s."state",
        s."pincode",
        s."addressLine",
        s."latitude",
        s."longitude",
        s."isFeatured",
        s."isVerified",
        s."viewsCount",
        s."likesCount",
        s."averageRating",
        s."ratingCount",
        s."createdAt",
        s."total",

        ${rankOuterExpr},
        ${distanceOuterExpr},

        LEFT(po."description", 200) AS "description",
        po."images" AS "images",

        ${snippetExpr},

        s."sellerId",
        s."sellerSlug",
        s."sellerReferenceCode",
        s."sellerHeadline",
        s."sellerLogoUrl",
        s."sellerType",

        s."variantId",
        s."variantName",
        s."bedrooms",
        s."bathrooms",
        s."price",
        s."mrpPrice",
        s."pricePerSqft",
        s."totalArea",
        s."totalAreaUnit",
        s."furnishingStatus",
        s."availabilityStatus"

      FROM (
        SELECT
          p."id",
          p."property_code" AS "propertyCode",
          p."title",
          p."slug",
          p."transaction_type" AS "transactionType",
          p."property_type" AS "propertyType",
          p."property_status" AS "propertyStatus",
          p."city",
          p."state",
          p."pincode",
          p."address_line" AS "addressLine",
          p."latitude",
          p."longitude",
          p."is_featured" AS "isFeatured",
          p."is_verified" AS "isVerified",
          p."views_count" AS "viewsCount",
          p."likes_count" AS "likesCount",
          p."average_rating" AS "averageRating",
          p."rating_count" AS "ratingCount",
          p."created_at" AS "createdAt",

          COUNT(*) OVER () AS "total",

          sp."id" AS "sellerId",
          sp."slug" AS "sellerSlug",
          sp."reference_code" AS "sellerReferenceCode",
          sp."headline" AS "sellerHeadline",
          sp."logo_url" AS "sellerLogoUrl",
          sp."seller_type" AS "sellerType",

          pv."id" AS "variantId",
          pv."variantName",
          pv."bedrooms",
          pv."bathrooms",
          pv."price",
          pv."mrpPrice",
          pv."pricePerSqft",
          pv."totalArea",
          pv."totalAreaUnit",
          pv."furnishingStatus",
          pv."availabilityStatus",

          ${rankInnerExpr},
          ${distanceInnerExpr}

        FROM "properties" p
        INNER JOIN "seller_profiles" sp ON sp."id" = p."seller_id"
        INNER JOIN LATERAL (
          SELECT
            pv."id",
            pv."variant_name" AS "variantName",
            pv."bedrooms",
            pv."bathrooms",
            pv."price",
            pv."mrp_price" AS "mrpPrice",
            pv."price_per_sqft" AS "pricePerSqft",
            pv."total_area" AS "totalArea",
            pv."total_area_unit" AS "totalAreaUnit",
            pv."furnishing_status" AS "furnishingStatus",
            pv."construction_status" AS "availabilityStatus"
          FROM "property_variants" pv
          WHERE pv."property_id" = p."id"
            AND ${variantWhere}
          ORDER BY pv."price" ASC NULLS LAST
          LIMIT 1
        ) pv ON true
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ${take} OFFSET ${skip}
      ) s
      INNER JOIN "properties" po ON po."id" = s."id"
    `;

  const total = rows.length ? Number(rows[0].total ?? 0) : 0;

  // --- Format response ---
  const formattedData = rows.map((row) => {
    const imgs: Array<{ url?: string; isFeatured?: boolean }> =
      Array.isArray(row.images) ? row.images : [];

    return {
      id: row.id,
      propertyCode: row.propertyCode,
      title: row.title,
      slug: row.slug,
      description: row.description,
      transactionType: row.transactionType,
      propertyType: row.propertyType,
      propertyStatus: row.propertyStatus,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      addressLine: row.addressLine,
      latitude: row.latitude,
      longitude: row.longitude,
      featuredImage: imgs.find((i) => i.isFeatured)?.url ?? imgs[0]?.url ?? null,
      isFeatured: row.isFeatured,
      isVerified: row.isVerified,
      viewsCount: row.viewsCount,
      likesCount: row.likesCount,
      averageRating: row.averageRating,
      ratingCount: row.ratingCount,
      createdAt: row.createdAt,
      imagesCount: imgs.length,

      distanceKm: row.distanceMeters != null
        ? Math.round((Number(row.distanceMeters) / 1000) * 100) / 100
        : null,
      textRank: row.textRank,
      snippet: row.snippet,

      seller: {
        id: row.sellerId,
        slug: row.sellerSlug,
        referenceCode: row.sellerReferenceCode,
        headline: row.sellerHeadline,
        logoUrl: row.sellerLogoUrl,
        sellerType: row.sellerType,
      },

      variant: {
        id: row.variantId,
        variantName: row.variantName,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        price: row.price,
        mrpPrice: row.mrpPrice,
        pricePerSqft: row.pricePerSqft,
        totalArea: row.totalArea,
        totalAreaUnit: row.totalAreaUnit,
        furnishingStatus: row.furnishingStatus,
        availabilityStatus: row.availabilityStatus,
      },
    };
  });

  // --- Build search metadata ---
  const searchMeta: SearchMeta = {
    hasLocation,
    searchRadiusKm: hasLocation ? (query.radiusKm || 5) : null,
    centerLat: hasLocation ? query.lat! : null,
    centerLng: hasLocation ? query.lng! : null,
  };

  return {
    data: formattedData,
    ...buildPagination(total, page, limit),
    searchMeta,
  };
};

export { searchProperties };
