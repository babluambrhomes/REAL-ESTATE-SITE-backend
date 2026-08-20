-- ============================================================
-- MIGRATION: Add Search Engine Infrastructure
-- PostGIS (geospatial) + tsvector (full-text) + pg_trgm (fuzzy)
-- ============================================================

-- 1. Enable PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add PostGIS geography column (for radius + bounding box search)
ALTER TABLE "properties"
  ADD COLUMN "geog" geography(Point, 4326);

-- 3. Backfill geography from existing lat/lng
UPDATE "properties"
  SET "geog" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

-- 4. Add tsvector column (full-text search — weighted generated column)
-- Weight A = title (highest relevance)
-- Weight B = description
-- Weight C = city, state (location context)
-- Weight D = amenities, nearbyPlaces (feature tags)
ALTER TABLE "properties"
  ADD COLUMN "search_vector" tsvector;

-- 5. Backfill search_vector for existing data
UPDATE "properties" SET "search_vector" =
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("city", '')), 'C') ||
  setweight(to_tsvector('english', coalesce("state", '')), 'C') ||
  setweight(to_tsvector('english',
    coalesce(
      (SELECT string_agg(value, ' ') FROM jsonb_array_elements_text("amenities") AS value), ''
    )
  ), 'D') ||
  setweight(to_tsvector('english',
    coalesce(
      (SELECT string_agg(value, ' ') FROM jsonb_array_elements_text("nearby_places") AS value), ''
    )
  ), 'D');

-- 6. GiST spatial index (for PostGIS ST_DWithin queries)
CREATE INDEX idx_property_geog
  ON "properties" USING GIST ("geog");

-- 7. GIN full-text search index (for tsvector @@ queries)
CREATE INDEX idx_property_search_vector
  ON "properties" USING GIN ("search_vector")
  WITH (fastupdate = off);

-- 8. GIN trigram index on title (for fuzzy matching + ILIKE acceleration)
CREATE INDEX idx_property_title_trgm
  ON "properties" USING GIN ("title" gin_trgm_ops);

-- 9. GiST trigram index on title (for KNN autocomplete ordering)
CREATE INDEX idx_property_title_trgm_gist
  ON "properties" USING GIST ("title" gist_trgm_ops);

-- 9b. GIN trigram index on pincode (for ILIKE pincode search)
CREATE INDEX idx_property_pincode_trgm
  ON "properties" USING GIN ("pincode" gin_trgm_ops);

-- 10. Composite partial indexes for common filter combinations
CREATE INDEX idx_property_search_active
  ON "properties" ("isActive", "deletedAt", "propertyStatus")
  WHERE "isActive" = true AND "deletedAt" IS NULL;

CREATE INDEX idx_property_city_type
  ON "properties" ("city", "propertyType", "transactionType")
  WHERE "isActive" = true AND "deletedAt" IS NULL;

-- 11. Helper function: extract text from JSONB array
CREATE OR REPLACE FUNCTION extract_jsonb_text(arr jsonb)
RETURNS text AS $$
  SELECT coalesce(string_agg(value, ' '), '')
  FROM jsonb_array_elements_text(arr) AS value
$$ LANGUAGE sql IMMUTABLE;

-- 12. Trigger function: auto-update search_vector on property changes
CREATE OR REPLACE FUNCTION update_property_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."city", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW."state", '')), 'C') ||
    setweight(to_tsvector('english',
      extract_jsonb_text(NEW."amenities")), 'D') ||
    setweight(to_tsvector('english',
      extract_jsonb_text(NEW."nearby_places")), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_property_search_vector
  BEFORE INSERT OR UPDATE OF "title", "description", "city", "state", "amenities", "nearby_places"
  ON "properties"
  FOR EACH ROW
  EXECUTE FUNCTION update_property_search_vector();

-- 13. Trigger function: auto-update geography column on lat/lng changes
CREATE OR REPLACE FUNCTION update_property_geog()
RETURNS trigger AS $$
BEGIN
  IF NEW."latitude" IS NOT NULL AND NEW."longitude" IS NOT NULL THEN
    NEW."geog" := ST_SetSRID(ST_MakePoint(NEW."longitude", NEW."latitude"), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_property_geog
  BEFORE INSERT OR UPDATE OF "latitude", "longitude"
  ON "properties"
  FOR EACH ROW
  EXECUTE FUNCTION update_property_geog();

-- 14. Analyze table for query planner
ANALYZE "properties";
