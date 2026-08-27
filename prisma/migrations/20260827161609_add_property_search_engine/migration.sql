-- ============================================================
-- SELLER FAQ / SELLER PROFILE modules & SEARCH ENGINE
-- ============================================================
-- This migration adds the search engine support that was missing
-- from the initial migration:
--   1. Trigger functions that keep "geog" and "searchVector"
--      (Unsupported PostGIS/tsvector columns) in sync with
--      conventional property columns.
--   2. GIST index on "geog" (radius / distance search).
--   3. GIN index on "searchVector" (full-text search).
--   4. Backfill for any existing rows.

-- ------------------------------------------------------------
-- 1. Trigger function: keep "geog" derived from lat/lng
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_property_geog() RETURNS trigger AS $$
BEGIN
  IF NEW."latitude" IS NOT NULL AND NEW."longitude" IS NOT NULL THEN
    NEW."geog" := ST_SetSRID(ST_MakePoint(NEW."longitude", NEW."latitude"), 4326)::geography;
  ELSE
    NEW."geog" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 2. Trigger function: build the search tsvector
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_property_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."city", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."state", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."property_type", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."description", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW."pincode", '')), 'D') ||
    setweight(to_tsvector('english', coalesce(NEW."property_code", '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 3. Attach triggers
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_property_geog_trigger ON "properties";
CREATE TRIGGER trg_property_geog_trigger
  BEFORE INSERT OR UPDATE ON "properties"
  FOR EACH ROW EXECUTE FUNCTION trg_property_geog();

DROP TRIGGER IF EXISTS trg_property_search_vector_trigger ON "properties";
CREATE TRIGGER trg_property_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "properties"
  FOR EACH ROW EXECUTE FUNCTION trg_property_search_vector();

-- ------------------------------------------------------------
-- 4. Backfill existing rows (triggers recompute on UPDATE)
-- ------------------------------------------------------------
UPDATE "properties"
SET "updated_at" = "updated_at"
WHERE "geog" IS NULL OR "searchVector" IS NULL;

-- ------------------------------------------------------------
-- 5. Supporting indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS properties_geog_gist_idx ON "properties" USING GIST ("geog");
CREATE INDEX IF NOT EXISTS properties_search_vector_gin_idx ON "properties" USING GIN ("searchVector");
