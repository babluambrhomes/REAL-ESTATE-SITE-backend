import { Prisma } from "../../generated/prisma/client";
import prisma from "../../config/prisma";
import redisConnection from "../../config/redis";
import { buildCacheKey, withCache, getCacheVersion } from "../../helpers";
import { SuggestionsQueryInput } from "./search.validation";
import type {
  CityFacet,
  PropertyTypeFacet,
  BhkFacet,
  PriceRangeFacet,
  TrendingSearch,
  SuggestionsFacets,
  SuggestionsResponse,
} from "./search.types";

// ============================================================
// Constants
// ============================================================

const TRENDING_KEY = "search:trending:queries";
const TRENDING_TTL_SECONDS = 7 * 24 * 60 * 60;
const TRENDING_LIMIT = 8;
const SUGGESTIONS_CACHE_TTL = 300;
const DEFAULT_RADIUS_KM = 50;
const CITY_LIMIT = 10;

interface PriceBucket {
  label: string;
  min: number;
  max: number | null;
}

const SALE_BUCKETS: PriceBucket[] = [
  { label: "0 - 10L", min: 0, max: 1_00_000 },
  { label: "10L - 25L", min: 1_00_000, max: 25_00_000 },
  { label: "25L - 50L", min: 25_00_000, max: 50_00_000 },
  { label: "50L - 1Cr", min: 50_00_000, max: 1_00_00_000 },
  { label: "1Cr - 2Cr", min: 1_00_00_000, max: 2_00_00_000 },
  { label: "2Cr+", min: 2_00_00_000, max: null },
];

const RENT_BUCKETS: PriceBucket[] = [
  { label: "0 - 10k", min: 0, max: 10_000 },
  { label: "10k - 20k", min: 10_000, max: 20_000 },
  { label: "20k - 30k", min: 20_000, max: 30_000 },
  { label: "30k - 50k", min: 30_000, max: 50_000 },
  { label: "50k - 1L", min: 50_000, max: 1_00_000 },
  { label: "1L+", min: 1_00_000, max: null },
];

// ============================================================
// Trending search tracking (Redis only — fire & forget)
// ============================================================

export const trackTrendingSearch = (rawQuery: string): void => {
  const normalized = rawQuery
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 100);

  if (normalized.length < 3) return;

  redisConnection
    .multi()
    .zincrby(TRENDING_KEY, 1, normalized)
    .expire(TRENDING_KEY, TRENDING_TTL_SECONDS)
    .exec()
    .catch(() => {});
};

const getTrendingSearches = async (): Promise<TrendingSearch[]> => {
  try {
    const flat = await redisConnection.zrevrange(
      TRENDING_KEY,
      0,
      TRENDING_LIMIT - 1,
      "WITHSCORES"
    );

    const results: TrendingSearch[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const query = flat[i];
      const score = Number(flat[i + 1]);
      if (query && query.length >= 3 && Number.isFinite(score)) {
        results.push({ query, score });
      }
    }
    return results;
  } catch {
    return [];
  }
};

// ============================================================
// Helpers
// ============================================================

const asArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

// ============================================================
// Facets — single SQL round-trip (CTEs)
// ============================================================

interface FacetScope {
  transactionType: "SALE" | "RENT";
  hasGeo: boolean;
  hasCity: boolean;
  radiusKm: number;
  city: string | null;
}

const buildFacets = async (
  query: SuggestionsQueryInput,
  scopeOpts: FacetScope
): Promise<SuggestionsFacets> => {
  const { transactionType, hasGeo, radiusKm, city } = scopeOpts;
  const buckets = transactionType === "RENT" ? RENT_BUCKETS : SALE_BUCKETS;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`p."is_active" = true`,
    Prisma.sql`p."deleted_at" IS NULL`,
    Prisma.sql`p."property_status" IN ('AVAILABLE', 'UNDER_OFFER')`,
    Prisma.sql`p."transaction_type" = ${transactionType}`,
  ];

  if (scopeOpts.hasCity && city) {
    conditions.push(Prisma.sql`LOWER(p."city") = LOWER(${city})`);
  }
  if (hasGeo) {
    conditions.push(
      Prisma.sql`ST_DWithin(p."geog", ST_SetSRID(ST_MakePoint(${query.lng!}, ${query.lat!}), 4326)::geography, ${radiusKm * 1000})`
    );
  }

  const scopeWhere = Prisma.join(conditions, " AND ");

  const priceCountExprs = Prisma.join(
    buckets.map((b, i) => {
      const alias = Prisma.raw(`b${i}`);
      return b.max === null
        ? Prisma.sql`COUNT(*) FILTER (WHERE pft."price" >= ${b.min}) AS ${alias}`
        : Prisma.sql`COUNT(*) FILTER (WHERE pft."price" >= ${b.min} AND pft."price" < ${b.max}) AS ${alias}`;
    }),
    ", "
  );

  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    WITH scope AS (
      SELECT p."id", p."city", p."property_type"
      FROM "properties" p
      WHERE ${scopeWhere}
    ),
    priced AS (
      SELECT mv."price"
      FROM scope s
      INNER JOIN LATERAL (
        SELECT pv."price"
        FROM "property_variants" pv
        WHERE pv."property_id" = s."id"
          AND pv."is_active" = true
        ORDER BY pv."price" ASC NULLS LAST
        LIMIT 1
      ) mv ON true
    ),
    city_facet AS (
      SELECT s."city", COUNT(*)::int AS "count"
      FROM scope s
      WHERE s."city" IS NOT NULL AND s."city" <> ''
      GROUP BY s."city"
      ORDER BY "count" DESC, s."city" ASC
      LIMIT ${CITY_LIMIT}
    ),
    type_facet AS (
      SELECT s."property_type"::text AS "type", COUNT(*)::int AS "count"
      FROM scope s
      GROUP BY s."property_type"
      ORDER BY "count" DESC, "type" ASC
    ),
    bhk_facet AS (
      SELECT pv."bedrooms", COUNT(DISTINCT pv."property_id")::int AS "count"
      FROM "property_variants" pv
      WHERE pv."is_active" = true
        AND pv."bedrooms" IS NOT NULL
        AND pv."property_id" IN (SELECT "id" FROM scope)
      GROUP BY pv."bedrooms"
      ORDER BY pv."bedrooms" ASC
    ),
    price_facet AS (
      SELECT
        COUNT(*)::int AS "total",
        ${priceCountExprs}
      FROM priced pft
    )
    SELECT
      (
        SELECT json_agg(json_build_object('city', c."city", 'count', c."count") ORDER BY c."count" DESC)
        FROM city_facet c
      ) AS "cities",
      (
        SELECT json_agg(json_build_object('type', t."type", 'count', t."count") ORDER BY t."count" DESC)
        FROM type_facet t
      ) AS "propertyTypes",
      (
        SELECT json_agg(json_build_object('bedrooms', b."bedrooms", 'count', b."count") ORDER BY b."bedrooms" ASC)
        FROM bhk_facet b
      ) AS "bhkOptions",
      pf.*
    FROM price_facet pf
  `;

  const row = rows[0] ?? {};

  const priceRanges: PriceRangeFacet[] = buckets.map((b, i) => ({
    label: b.label,
    min: b.min,
    max: b.max,
    count: Number(row[`b${i}`] ?? 0),
  }));

  return {
    cities: asArray<CityFacet>(row.cities),
    priceRanges,
    propertyTypes: asArray<PropertyTypeFacet>(row.propertyTypes),
    bhkOptions: asArray<BhkFacet>(row.bhkOptions),
    scope: {
      city,
      centerLat: hasGeo ? query.lat! : null,
      centerLng: hasGeo ? query.lng! : null,
      radiusKm: hasGeo ? radiusKm : null,
      transactionType,
    },
  };
};

// ============================================================
// Main — cached facets + fresh trending
// ============================================================

export const getSearchSuggestions = async (
  query: SuggestionsQueryInput
): Promise<SuggestionsResponse> => {
  const transactionType: "SALE" | "RENT" = query.transactionType ?? "SALE";
  const hasGeo = query.lat !== undefined && query.lng !== undefined;
  const hasCity = Boolean(query.city && query.city.trim().length > 0);
  const city = hasCity ? query.city!.trim() : null;
  const radiusKm = query.radiusKm ?? DEFAULT_RADIUS_KM;

  const cacheVersion = await getCacheVersion();
  const cacheKey = buildCacheKey("search:suggestions:v1", {
    v: cacheVersion,
    city,
    lat: hasGeo ? Math.round(query.lat! * 100) / 100 : null,
    lng: hasGeo ? Math.round(query.lng! * 100) / 100 : null,
    radiusKm: hasGeo ? radiusKm : null,
    transactionType,
  });

  const facets = await withCache(
    cacheKey,
    () =>
      buildFacets(query, {
        transactionType,
        hasGeo,
        hasCity,
        radiusKm,
        city,
      }),
    { ttl: SUGGESTIONS_CACHE_TTL }
  );

  const trendingSearches = await getTrendingSearches();

  return { ...facets, trendingSearches };
};
