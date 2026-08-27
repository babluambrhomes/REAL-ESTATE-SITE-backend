-- ============================================================
-- SEARCH PERFORMANCE INDEXES
-- ============================================================
-- Partial indexes tuned for the LATERAL-based search query:
--   1. Cheapest active variant per property (LATERAL ORDER BY price LIMIT 1)
--   2. BHK-filtered LATERAL scans
--   3. Default 'newest' sort on public listings
--
-- Partial indexes cannot be expressed in the Prisma schema, so
-- they are managed here as raw SQL.

-- Cheapest active variant per property
CREATE INDEX IF NOT EXISTS property_variants_property_price_active_idx
  ON "property_variants" ("property_id", "price")
  WHERE "is_active" = true;

-- BHK-filtered LATERAL scans
CREATE INDEX IF NOT EXISTS property_variants_property_bedrooms_active_idx
  ON "property_variants" ("property_id", "bedrooms")
  WHERE "is_active" = true;

-- Default 'newest' sort on public listings
CREATE INDEX IF NOT EXISTS properties_public_search_idx
  ON "properties" ("created_at" DESC)
  WHERE "is_active" = true AND "deleted_at" IS NULL
    AND "property_status" IN ('AVAILABLE', 'UNDER_OFFER');
