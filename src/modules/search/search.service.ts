import { Prisma } from "../../generated/prisma/client";
import prisma from "../../config/prisma";
import { getPaginationParams, buildPaginatedResponse, buildCacheKey, withCache, getCacheVersion } from "../../helpers";
import { SearchQueryInput } from "./search.validation";
import type { SearchResponse, SearchMeta } from "./search.types";

// ============================================================
// Helpers
// ============================================================

const sanitizeSearchQuery = (q: string): string => {
  return q
    .replace(/[!|&():*"'\[\]\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const escapeLikeWildcard = (input: string): string => {
  return input.replace(/%/g, "\\%").replace(/_/g, "\\_");
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
  conditions.push(Prisma.sql`p."isActive" = true`);
  conditions.push(Prisma.sql`p."deletedAt" IS NULL`);
  // Public search only exposes available / under-offer listings
  conditions.push(Prisma.sql`p."propertyStatus" IN ('AVAILABLE', 'UNDER_OFFER')`);

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
    conditions.push(Prisma.sql`p."transactionType" = ${query.transactionType}`);
  }
  if (query.propertyType) {
    conditions.push(Prisma.sql`p."propertyType" = ${query.propertyType}`);
  }
  if (query.propertyStatus) {
    conditions.push(Prisma.sql`p."propertyStatus" = ${query.propertyStatus}`);
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
    conditions.push(Prisma.sql`p."ownershipType" = ${query.ownershipType}`);
  }
  if (query.listedBy) {
    conditions.push(Prisma.sql`p."listedBy" = ${query.listedBy}`);
  }
  if (query.isFeatured !== undefined) {
    conditions.push(Prisma.sql`p."isFeatured" = ${query.isFeatured === "true"}`);
  }
  if (query.isVerified !== undefined) {
    conditions.push(Prisma.sql`p."isVerified" = ${query.isVerified === "true"}`);
  }
  if (query.sellerSlug) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "SellerProfile" sp
        WHERE sp."id" = p."sellerId" AND sp."slug" = ${query.sellerSlug}
      )`
    );
  }

  // --- Variant filters (used by LATERAL selection AND count EXISTS) ---
  const variantConditions: Prisma.Sql[] = [Prisma.sql`pv."isActive" = true`];

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
    variantConditions.push(Prisma.sql`pv."furnishingStatus" = ${query.furnishingStatus}`);
  }
  if (query.availabilityStatus) {
    variantConditions.push(Prisma.sql`pv."availabilityStatus" = ${query.availabilityStatus}`);
  }

  const variantWhere = Prisma.join(variantConditions, " AND ");

  // --- Combine all property-level conditions ---
  const whereClause = Prisma.join(conditions, " AND ");

  // --- Build SELECT columns ---
  const distanceExpr = hasLocation
    ? Prisma.sql`ST_Distance(p."geog", ST_SetSRID(ST_MakePoint(${query.lng!}, ${query.lat!}), 4326)::geography)::float8 AS "distanceMeters"`
    : Prisma.sql`NULL::float8 AS "distanceMeters"`;

  const rankExpr = safeHasText
    ? Prisma.sql`ts_rank(p."searchVector", websearch_to_tsquery('english', ${sanitizedQ}), 1)::float8 AS "textRank"`
    : Prisma.sql`NULL::float8 AS "textRank"`;

  const snippetExpr = safeHasText
    ? Prisma.sql`ts_headline('english', coalesce(p."description", ''), websearch_to_tsquery('english', ${sanitizedQ}), 'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=10') AS "snippet"`
    : Prisma.sql`NULL::text AS "snippet"`;

  // --- Build ORDER BY (genuine outer sort on the LATERAL-selected variant) ---
  let orderBy: Prisma.Sql;
  const sort = query.sort || (safeHasText ? "relevance" : hasLocation ? "distance" : "newest");

  switch (sort) {
    case "relevance":
      orderBy = safeHasText
        ? Prisma.sql`"textRank" DESC, "distanceMeters" ASC NULLS LAST, p."createdAt" DESC`
        : Prisma.sql`p."createdAt" DESC`;
      break;
    case "distance":
      orderBy = hasLocation
        ? Prisma.sql`"distanceMeters" ASC NULLS LAST, p."createdAt" DESC`
        : Prisma.sql`p."createdAt" DESC`;
      break;
    case "price_asc":
      orderBy = Prisma.sql`pv."price" ASC NULLS LAST, p."createdAt" DESC`;
      break;
    case "price_desc":
      orderBy = Prisma.sql`pv."price" DESC NULLS LAST, p."createdAt" DESC`;
      break;
    case "popular":
      orderBy = Prisma.sql`p."viewsCount" DESC, p."likesCount" DESC`;
      break;
    default:
      orderBy = Prisma.sql`p."createdAt" DESC`;
  }

  // --- Execute queries inside transaction with timeout protection ---
  const [countResult, rows] = await prisma.$transaction(async (tx) => {
    // 5 second query timeout — prevents long-running distance/text searches
    await tx.$executeRaw`SET LOCAL statement_timeout = '5000'`;

    const count = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(p."id")::bigint AS count
      FROM "Property" p
      WHERE ${whereClause}
        AND EXISTS (
          SELECT 1 FROM "PropertyVariant" pv
          WHERE pv."propertyId" = p."id"
          AND ${variantWhere}
        )
    `;

    const resultRows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        p."id",
        p."propertyCode",
        p."title",
        p."slug",
        LEFT(p."description", 200) AS "description",
        p."transactionType",
        p."propertyType",
        p."propertyStatus",
        p."city",
        p."state",
        p."pincode",
        p."addressLine",
        p."latitude",
        p."longitude",
        p."isFeatured",
        p."isVerified",
        p."viewsCount",
        p."likesCount",
        p."averageRating",
        p."ratingCount",
        p."createdAt",

        -- Extract only featured image URL + total count (no full array transfer)
        COALESCE(
          (SELECT e->>'url' FROM jsonb_array_elements(p."images") e WHERE (e->>'isFeatured')::boolean = true LIMIT 1),
          (SELECT e->>'url' FROM jsonb_array_elements(p."images") e LIMIT 1)
        ) AS "featuredImageUrl",
        jsonb_array_length(COALESCE(p."images", '[]'::jsonb)) AS "imagesCount",

        ${distanceExpr},
        ${rankExpr},
        ${snippetExpr},

        -- Seller info
        sp."id" AS "sellerId",
        sp."slug" AS "sellerSlug",
        sp."referenceCode" AS "sellerReferenceCode",
        sp."headline" AS "sellerHeadline",
        sp."logoUrl" AS "sellerLogoUrl",
        sp."sellerType" AS "sellerType",

        -- Best matching variant (LATERAL picks 1 per property)
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
        pv."availabilityStatus"

      FROM "Property" p
      INNER JOIN "SellerProfile" sp ON sp."id" = p."sellerId"
      INNER JOIN LATERAL (
        SELECT
          pv."id",
          pv."variantName",
          pv."bedrooms",
          pv."bathrooms",
          pv."price",
          pv."mrpPrice",
          pv."pricePerSqft",
          pv."totalArea",
          pv."totalAreaUnit",
          pv."furnishingStatus",
          pv."availabilityStatus"
        FROM "PropertyVariant" pv
        WHERE pv."propertyId" = p."id"
          AND ${variantWhere}
        ORDER BY pv."price" ASC NULLS LAST
        LIMIT 1
      ) pv ON true
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${take} OFFSET ${skip}
    `;

    return [count, resultRows] as const;
  });

  const total = Number(countResult[0]?.count ?? 0);

  // --- Format response ---
  const formattedData = rows.map((row) => {
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
      featuredImage: row.featuredImageUrl ?? null,
      isFeatured: row.isFeatured,
      isVerified: row.isVerified,
      viewsCount: row.viewsCount,
      likesCount: row.likesCount,
      averageRating: row.averageRating,
      ratingCount: row.ratingCount,
      createdAt: row.createdAt,
      imagesCount: row.imagesCount ?? 0,

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
    ...buildPaginatedResponse(formattedData, total, page, limit),
    searchMeta,
  };
};

export { searchProperties };
