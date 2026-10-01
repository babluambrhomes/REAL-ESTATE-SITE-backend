-- ============================================================
-- MIGRATION: seller_org_ownership_and_lifecycle_enums
-- ============================================================
-- This migration implements the agreed model:
--
--   1. SellerProfile splits into two real kinds
--        INDIVIDUAL   → user_id = <user>, organization_id = NULL
--        ORGANIZATION → user_id = NULL, organization_id = <org>
--      enforced by a DB CHECK constraint, not just application code.
--
--   2. Property.seller_id is REMOVED. Ownership is now decided by
--        user_id (creator) + organization_id (optional).
--
--   3. Soft delete moves from ad-hoc booleans/timestamps to one
--      lifecycle enum per model:
--        properties.is_active        → listing_status
--        properties.is_verified      → verification_status
--        properties.deleted_at       → listing_status = 'DELETED'
--        seller_profiles.is_active   → seller_status
--        seller_profiles.deleted_at  → seller_status = 'DELETED'
--        buyer_profiles.is_active    → buyer_status
--        seller_blog_posts.deleted_at→ status = 'ARCHIVED'
--
--   4. members/roles uniqueness fixed. The old compound
--      @@unique([scope, contextId, ...]) silently did nothing for
--      PLATFORM rows because NULLs are DISTINCT in Postgres.
--
-- Existing data is migrated, not discarded. The backfills are
-- lossless — see the comment above each one.
-- ============================================================


-- ============================================================
-- SECTION 1 — Enum types
-- ============================================================

-- ⚠ WHY 'ListingStatus' IS RECREATED INSTEAD OF EXTENDED
-- --------------------------------------------------------
-- The obvious way to add a value is:
--     ALTER TYPE "ListingStatus" ADD VALUE 'DELETED';
--
-- That would force this migration to be split in two, because Postgres
-- refuses to let a newly-added enum value be USED inside the same
-- transaction that added it ("unsafe use of new value of enum type").
-- The soft-delete backfill in Section 4c needs exactly that value, so
-- an ALTER-based approach would mean either a data-losing ordering
-- hazard or a two-migration dance where one of them guards the other.
--
-- ListingStatus is DEAD: no column in any environment used it (verified
-- — zero columns reference the type), and no code referenced the enum.
-- Recreating the type is therefore both safe and simpler, and it lets
-- 'DELETED' be used immediately.
--
-- The guard below fails loudly if some environment DOES have a column
-- using this type, so nobody loses data to a silent drop.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_type t ON t.oid = a.atttypid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE t.typname = 'ListingStatus'
           AND a.attnum > 0 AND NOT a.attisdropped
           AND n.nspname = 'public'
    ) THEN
        RAISE EXCEPTION
            'Cannot recreate type ListingStatus: a column still uses it. '
            'Use ALTER TYPE ... ADD VALUE ''DELETED'' in a separate migration instead.';
    END IF;
END $$;

DROP TYPE IF EXISTS "ListingStatus";

CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'EXPIRED', 'REJECTED', 'DELETED');

CREATE TYPE "SellerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "BuyerStatus"  AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');


-- ============================================================
-- SECTION 2 — Data cleanup that MUST happen before constraints
-- ============================================================

-- ------------------------------------------------------------
-- 2a. persons.last_name: NOT NULL → nullable, empty string → NULL
-- ------------------------------------------------------------
-- Relaxed FIRST, then normalised. The order matters: writing NULL into
-- a still-NOT NULL column fails with
--   "null value in column last_name violates not-null constraint".
--
-- The normalisation exists because 12 of 14 rows held '' rather than
-- NULL, which would defeat the point of making the column optional:
-- the app checks for a last name, sees '', and renders an empty
-- element. One honest "no last name" state is easier to reason about
-- than two.
--
-- Only '' is touched — real names are left completely alone.
ALTER TABLE "persons" ALTER COLUMN "last_name" DROP NOT NULL;

UPDATE "persons" SET "last_name" = NULL WHERE "last_name" = '';

-- ------------------------------------------------------------
-- 2b. seller_verification_documents: exactly one context
-- ------------------------------------------------------------
-- A verification document belongs to EITHER a seller profile OR an
-- organization — never both. Both rows in the live data had both
-- columns populated, so adding the CHECK constraint below would have
-- failed outright.
--
-- Fix: when the linked seller profile is an ORGANIZATION profile,
-- the document is a company document → keep organization_id, clear
-- seller_id. Otherwise keep seller_id, clear organization_id.
--
-- This matches the new model, where an ORGANIZATION seller profile
-- has no user behind it and company KYC hangs off the org.
UPDATE "seller_verification_documents" svd
   SET seller_id = NULL
  FROM "seller_profiles" sp
 WHERE sp.id = svd.seller_id
   AND sp.seller_type = 'ORGANIZATION'
   AND svd.organization_id IS NOT NULL;

UPDATE "seller_verification_documents" svd
   SET organization_id = NULL
  FROM "seller_profiles" sp
 WHERE sp.id = svd.seller_id
   AND sp.seller_type = 'INDIVIDUAL';

-- Any row that somehow has neither context would still violate the
-- CHECK; fail loudly rather than silently guess which side it meant.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "seller_verification_documents"
                WHERE seller_id IS NULL AND organization_id IS NULL) THEN
        RAISE EXCEPTION
            'seller_verification_documents has rows with neither seller_id nor organization_id. '
            'Assign each row a seller profile or an organization before retrying.';
    END IF;
END $$;


-- ============================================================
-- SECTION 3 — Add new columns (nullable / defaulted first)
-- ============================================================
-- New columns go in BEFORE the old ones are dropped so that the
-- backfills in Section 4 have both sides available.

-- Property: ownership by creator + org
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "user_id" UUID;
-- Property: visibility lifecycle
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "listing_status" "ListingStatus";
-- Property: verification lifecycle
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "verification_status" "VerificationStatus";

-- SellerProfile / BuyerProfile lifecycle
ALTER TABLE "seller_profiles" ADD COLUMN IF NOT EXISTS "seller_status" "SellerStatus";
ALTER TABLE "buyer_profiles"  ADD COLUMN IF NOT EXISTS "buyer_status"  "BuyerStatus";

-- Organization: company PAN (comment claimed this existed; it did not)
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "pan_number" TEXT;

-- Manual lead / visit / question assignment inside an org
ALTER TABLE "lead_forms"      ADD COLUMN IF NOT EXISTS "assigned_to_member_id" UUID;
ALTER TABLE "site_visits"     ADD COLUMN IF NOT EXISTS "assigned_to_member_id" UUID;
ALTER TABLE "buyer_questions" ADD COLUMN IF NOT EXISTS "assigned_to_member_id" UUID;


-- ============================================================
-- SECTION 4 — Backfill new columns from old ones
-- ============================================================

-- ------------------------------------------------------------
-- 4a. properties.user_id — from the old seller profile's owner
-- ------------------------------------------------------------
-- LOSSLESS. Today every property belongs to exactly one seller
-- profile, and every seller profile has a user_id (it was NOT NULL).
-- So joining through seller_id recovers the creator exactly.
--
-- Verified before writing this: 21/21 properties join successfully and
-- no seller profile has a NULL user_id, so no property is skipped.
UPDATE "properties" p
   SET "user_id" = sp."user_id"
  FROM "seller_profiles" sp
 WHERE p."seller_id" = sp."id"
   AND p."user_id" IS NULL;

-- ------------------------------------------------------------
-- 4b. properties.organization_id — inherit from the seller profile
-- ------------------------------------------------------------
-- LOSSLESS. One org-sold property had organization_id = NULL while its
-- seller profile was an ORGANIZATION profile. That is exactly the
-- mixed state this migration removes, so it is filled in from the
-- seller profile before the old FK goes away.
--
-- Individual-seller properties correctly stay NULL.
UPDATE "properties" p
   SET "organization_id" = sp."organization_id"
  FROM "seller_profiles" sp
 WHERE p."seller_id" = sp."id"
   AND sp."organization_id" IS NOT NULL
   AND p."organization_id" IS NULL;

-- ------------------------------------------------------------
-- 4c. properties.listing_status — from is_active / deleted_at
-- ------------------------------------------------------------
-- is_active and deleted_at carried TWO independent answers to one
-- question ("should this listing be visible?"), which is how the two
-- could disagree. Collapsed into one field, preserving the old
-- meaning as closely as possible:
--
--   deleted_at IS NOT NULL    → DELETED   (soft-deleted)
--   property_status = DRAFT   → DRAFT     (never published)
--   is_active = false         → PAUSED    (hidden but kept)
--   otherwise                 → PUBLISHED (live listing)
--
-- All 21 existing rows are AVAILABLE, active and not soft-deleted,
-- so they all become PUBLISHED. The other branches are here so the
-- migration is correct on any environment, not just this one.
--
-- 'DELETED' is usable immediately because Section 1 recreated the enum
-- type rather than extending it.
UPDATE "properties" SET "listing_status" = 'DELETED'
 WHERE "deleted_at" IS NOT NULL;

UPDATE "properties" SET "listing_status" = 'DRAFT'
 WHERE "deleted_at" IS NULL
   AND "property_status" = 'DRAFT'
   AND "listing_status" IS NULL;

UPDATE "properties" SET "listing_status" = 'PAUSED'
 WHERE "deleted_at" IS NULL
   AND "property_status" <> 'DRAFT'
   AND "is_active" = false
   AND "listing_status" IS NULL;

UPDATE "properties" SET "listing_status" = 'PUBLISHED'
 WHERE "deleted_at" IS NULL
   AND "property_status" <> 'DRAFT'
   AND "is_active" = true
   AND "listing_status" IS NULL;

-- Safety net: nothing should have been missed above.
UPDATE "properties" SET "listing_status" = 'PUBLISHED' WHERE "listing_status" IS NULL;

-- ------------------------------------------------------------
-- 4d. properties.verification_status — from is_verified
-- ------------------------------------------------------------
-- LOSSLESS. Aligns Property with SellerProfile and Organization,
-- which both already used VerificationStatus.
--
-- 20 rows were is_verified = true → VERIFIED; 1 → PENDING.
UPDATE "properties" SET "verification_status" = 'VERIFIED'
 WHERE "is_verified" = true AND "verification_status" IS NULL;

UPDATE "properties" SET "verification_status" = 'PENDING'
 WHERE "is_verified" = false AND "verification_status" IS NULL;

-- ------------------------------------------------------------
-- 4e. seller_profiles.seller_status — from is_active / deleted_at
-- ------------------------------------------------------------
UPDATE "seller_profiles" SET "seller_status" = 'DELETED'  WHERE "deleted_at" IS NOT NULL;
UPDATE "seller_profiles" SET "seller_status" = 'SUSPENDED' WHERE "deleted_at" IS NULL AND "is_active" = false;
UPDATE "seller_profiles" SET "seller_status" = 'ACTIVE'    WHERE "deleted_at" IS NULL AND "is_active" = true;
UPDATE "seller_profiles" SET "seller_status" = 'ACTIVE'    WHERE "seller_status" IS NULL;

-- ------------------------------------------------------------
-- 4f. buyer_profiles.buyer_status — from is_active
-- ------------------------------------------------------------
UPDATE "buyer_profiles" SET "buyer_status" = 'ACTIVE'    WHERE "is_active" = true;
UPDATE "buyer_profiles" SET "buyer_status" = 'SUSPENDED' WHERE "is_active" = false;
UPDATE "buyer_profiles" SET "buyer_status" = 'ACTIVE'    WHERE "buyer_status" IS NULL;

-- ------------------------------------------------------------
-- 4f2. seller_blog_posts: deleted_at → status = 'ARCHIVED'
-- ------------------------------------------------------------
-- Blog posts have no separate is_active column, so the mapping is
-- direct: a soft-deleted post becomes ARCHIVED. Run before the column
-- is dropped in Section 6.
--
-- ARCHIVED is the existing BlogStatus value meant for exactly this,
-- which is why no new enum value was needed for blog posts.
UPDATE "seller_blog_posts" SET "status" = 'ARCHIVED'
 WHERE "deleted_at" IS NOT NULL;

-- ------------------------------------------------------------
-- 4g. seller_profiles.user_id — NULL for ORGANIZATION profiles
-- ------------------------------------------------------------
-- THE core change of this migration.
--
-- An ORGANIZATION seller profile represents a COMPANY, not a person.
-- Keeping a user_id on it is what forced the original schema to make
-- user_id NOT NULL and therefore made org selling impossible to model
-- correctly.
--
-- No information is lost: for every org profile, user_id already
-- equalled the organization's created_by (verified for all existing
-- rows), and that stays available on Organization.createdBy.
--
-- The NOT NULL is relaxed FIRST — nulling the column while it is still
-- mandatory fails immediately.
--
-- user_id KEEPS its unique constraint. That is deliberate: it is what
-- guarantees one individual seller profile per user, and Postgres lets
-- many rows hold NULL in a unique column, so unlimited org profiles
-- still work.
ALTER TABLE "seller_profiles" ALTER COLUMN "user_id" DROP NOT NULL;

UPDATE "seller_profiles" SET "user_id" = NULL
 WHERE "seller_type" = 'ORGANIZATION' AND "organization_id" IS NOT NULL;


-- ============================================================
-- SECTION 5 — Make new columns required
-- ============================================================

-- Every property must have a creator. seller_id was NOT NULL before,
-- and the 4a backfill filled user_id for every row, so this holds.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "properties" WHERE "user_id" IS NULL) THEN
        RAISE EXCEPTION
            'properties.user_id is NULL for some rows — the seller_id backfill did not cover them. '
            'Assign a creator user to each property before retrying.';
    END IF;
END $$;

ALTER TABLE "properties"       ALTER COLUMN "user_id"             SET NOT NULL;
ALTER TABLE "properties"       ALTER COLUMN "listing_status"      SET NOT NULL;
ALTER TABLE "properties"       ALTER COLUMN "verification_status" SET NOT NULL;
ALTER TABLE "seller_profiles"  ALTER COLUMN "seller_status"       SET NOT NULL;
ALTER TABLE "buyer_profiles"   ALTER COLUMN "buyer_status"        SET NOT NULL;

-- Stable defaults for future inserts
ALTER TABLE "properties"       ALTER COLUMN "listing_status"      SET DEFAULT 'DRAFT';
ALTER TABLE "properties"       ALTER COLUMN "verification_status" SET DEFAULT 'PENDING';
ALTER TABLE "seller_profiles"  ALTER COLUMN "seller_status"       SET DEFAULT 'ACTIVE';
ALTER TABLE "buyer_profiles"   ALTER COLUMN "buyer_status"        SET DEFAULT 'ACTIVE';


-- ============================================================
-- SECTION 6 — Drop the old columns, FKs and indexes
-- ============================================================

-- Partial index whose predicate references is_active + deleted_at.
-- It MUST be dropped before those columns can be dropped; it is
-- recreated against listing_status in Section 9.
DROP INDEX IF EXISTS "properties_public_search_idx";

-- Foreign keys that must go before their columns
ALTER TABLE "properties"      DROP CONSTRAINT IF EXISTS "properties_seller_id_fkey";
ALTER TABLE "properties"      DROP CONSTRAINT IF EXISTS "properties_organization_id_fkey";
ALTER TABLE "seller_profiles" DROP CONSTRAINT IF EXISTS "seller_profiles_organization_id_fkey";

-- Now the columns themselves
ALTER TABLE "properties" DROP COLUMN IF EXISTS "seller_id";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "is_active";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "is_verified";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "deleted_at";

ALTER TABLE "seller_profiles" DROP COLUMN IF EXISTS "is_active";
ALTER TABLE "seller_profiles" DROP COLUMN IF EXISTS "deleted_at";

ALTER TABLE "buyer_profiles" DROP COLUMN IF EXISTS "is_active";

ALTER TABLE "seller_blog_posts" DROP COLUMN IF EXISTS "deleted_at";

-- Indexes on the dropped columns
DROP INDEX IF EXISTS "properties_seller_id_idx";
DROP INDEX IF EXISTS "properties_is_active_idx";
DROP INDEX IF EXISTS "properties_is_verified_idx";
DROP INDEX IF EXISTS "properties_deleted_at_idx";

-- properties_property_code_idx duplicated the existing
-- UNIQUE(properties.property_code) — the UNIQUE already builds a btree.
DROP INDEX IF EXISTS "properties_property_code_idx";

-- The broken compound uniques being replaced by partial uniques
DROP INDEX IF EXISTS "members_scope_context_id_user_id_key";
DROP INDEX IF EXISTS "roles_scope_context_id_role_name_key";


-- ============================================================
-- SECTION 7 — Foreign keys for the new columns
-- ============================================================
-- onDelete choices, and why:
--
--   properties.user_id → RESTRICT
--     user_id is NOT NULL (every listing has a known creator), so
--     ON DELETE SET NULL is not even expressible. Restrict states the
--     real rule: you cannot hard-delete a user who owns listings.
--     This is consistent with the wider model — users are soft-deleted
--     via UserStatus.DEACTIVATED, never hard-deleted. Cascade would
--     wipe a company's portfolio because one employee closed their
--     account.
--
--   properties.organization_id → RESTRICT
--     An org that still owns listings must not be deleted. Orgs are
--     soft-deleted via OrganizationStatus.DEACTIVATED instead.
--
--   seller_profiles.organization_id → CASCADE
--     The public profile IS the org's presence. Deleting the org takes
--     it. (Was SET NULL, which would have violated the CHECK below.)
--
--   *_assigned_to_member_id → SET NULL
--     Removing a member from an org returns their assigned leads to the
--     org pool (assigned = NULL means "unassigned") rather than
--     destroying them.

ALTER TABLE "properties"      ADD CONSTRAINT "properties_user_id_fkey"      FOREIGN KEY ("user_id")             REFERENCES "users"("id")         ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "properties"      ADD CONSTRAINT "properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "lead_forms"      ADD CONSTRAINT "lead_forms_assigned_to_member_id_fkey"      FOREIGN KEY ("assigned_to_member_id") REFERENCES "members"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "site_visits"     ADD CONSTRAINT "site_visits_assigned_to_member_id_fkey"     FOREIGN KEY ("assigned_to_member_id") REFERENCES "members"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "buyer_questions" ADD CONSTRAINT "buyer_questions_assigned_to_member_id_fkey" FOREIGN KEY ("assigned_to_member_id") REFERENCES "members"("id") ON UPDATE CASCADE ON DELETE SET NULL;


-- ============================================================
-- SECTION 8 — New indexes and partial uniques
-- ============================================================

-- lifecycle indexes
CREATE INDEX IF NOT EXISTS "properties_listing_status_idx"      ON "properties"("listing_status");
CREATE INDEX IF NOT EXISTS "properties_verification_status_idx" ON "properties"("verification_status");
CREATE INDEX IF NOT EXISTS "properties_user_id_idx"             ON "properties"("user_id");
CREATE INDEX IF NOT EXISTS "seller_profiles_seller_status_idx"  ON "seller_profiles"("seller_status");
CREATE INDEX IF NOT EXISTS "buyer_profiles_buyer_status_idx"    ON "buyer_profiles"("buyer_status");

-- manual assignment indexes ("my leads" / "my visits" / "my questions")
CREATE INDEX IF NOT EXISTS "lead_forms_assigned_to_member_id_status_idx"      ON "lead_forms"("assigned_to_member_id", "status");
CREATE INDEX IF NOT EXISTS "site_visits_assigned_to_member_id_status_idx"     ON "site_visits"("assigned_to_member_id", "status");
CREATE INDEX IF NOT EXISTS "buyer_questions_assigned_to_member_id_status_idx" ON "buyer_questions"("assigned_to_member_id", "status");

-- membership lookup helpers
CREATE INDEX IF NOT EXISTS "members_scope_user_id_idx" ON "members"("scope", "user_id");
CREATE INDEX IF NOT EXISTS "members_status_idx"       ON "members"("status");
CREATE INDEX IF NOT EXISTS "roles_scope_role_name_idx" ON "roles"("scope", "role_name");

-- ONE public seller profile per organization.
-- Created before the CHECK constraint below, and verified non-empty of
-- duplicates beforehand (0 duplicate groups existed).
CREATE UNIQUE INDEX IF NOT EXISTS "seller_profiles_organization_id_key" ON "seller_profiles"("organization_id");

-- Partial uniques replacing the broken compound uniques.
--
-- Postgres treats NULLs as DISTINCT, so
--   UNIQUE (scope, context_id, user_id)
-- enforces nothing at all for PLATFORM rows (context_id IS NULL) —
-- the same platform member could be inserted any number of times.
-- Two partial uniques fix it by splitting on context_id's nullness.
--
-- The org-scoped indexes deliberately REUSE the old index names
-- (members_scope_context_id_user_id_key, roles_scope_context_id_role_name_key).
-- They were dropped in Section 6 and are recreated here with a partial
-- predicate, so the name stays stable and only the definition changes.
-- Prisma derives these exact names for partial @@unique and ignores any
-- custom `name:`, so these strings must not be "tidied up".
--
-- The platform-scoped ones are new: an org-scoped UNIQUE containing
-- context_id can never enforce uniqueness for rows where it is NULL.
CREATE UNIQUE INDEX IF NOT EXISTS "members_scope_context_id_user_id_key" ON "members"("scope", "context_id", "user_id") WHERE "context_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "members_scope_user_id_key"             ON "members"("scope", "user_id")                     WHERE "context_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "roles_scope_context_id_role_name_key"  ON "roles"("scope", "context_id", "role_name")        WHERE "context_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "roles_scope_role_name_key"             ON "roles"("scope", "role_name")                       WHERE "context_id" IS NULL;


-- ============================================================
-- SECTION 9 — CHECK constraints (the real enforcement)
-- ============================================================
-- Prisma cannot express CHECK constraints, so they live here as raw
-- SQL. This is deliberate: these are the rules that make the two
-- seller kinds impossible to confuse, and they must hold even if some
-- future code path forgets to validate in application code.

-- ------------------------------------------------------------
-- 9a. A seller profile is EITHER individual OR organizational
-- ------------------------------------------------------------
-- Individual  : user_id NOT NULL, organization_id NULL
-- Organization: user_id NULL,     organization_id NOT NULL
--
-- The two nullable unique columns (user_id, organization_id) together
-- already enforce cardinality — max one profile per user, max one per
-- org — because NULLs do not collide in a unique index. What they
-- cannot express is the pairing, which is what this CHECK adds.
ALTER TABLE "seller_profiles"
  DROP CONSTRAINT IF EXISTS "seller_profiles_owner_check";

ALTER TABLE "seller_profiles"
  ADD CONSTRAINT "seller_profiles_owner_check" CHECK (
      ( "seller_type" = 'INDIVIDUAL'   AND "user_id" IS NOT NULL AND "organization_id" IS NULL )
   OR ( "seller_type" = 'ORGANIZATION' AND "user_id" IS NULL     AND "organization_id" IS NOT NULL )
  );

-- ------------------------------------------------------------
-- 9b. A verification document has exactly one owner context
-- ------------------------------------------------------------
-- Prevents a document being attached to a seller AND an organization
-- at once, which is how the two live rows ended up ambiguous.
ALTER TABLE "seller_verification_documents"
  DROP CONSTRAINT IF EXISTS "seller_verification_documents_context_check";

ALTER TABLE "seller_verification_documents"
  ADD CONSTRAINT "seller_verification_documents_context_check" CHECK (
      ("seller_id" IS NOT NULL AND "organization_id" IS NULL)
   OR ("seller_id" IS NULL     AND "organization_id" IS NOT NULL)
  );

-- ------------------------------------------------------------
-- 9c. Invariant that CANNOT be a CHECK (documented, not enforced)
-- ------------------------------------------------------------
-- "An ORGANIZATION seller profile belongs to an ACTIVE org" is a
-- cross-table rule, and Postgres CHECK constraints cannot reference
-- another table. It is therefore enforced in the application layer:
-- the org deactivate flow sets OrganizationStatus.DEACTIVATED and
-- SellerStatus.SUSPENDED on the org's profile in one transaction
-- (see org.service in Phase 3).
--
-- Documented here so the invariant lives next to the definition
-- instead of only in someone's head.


-- ============================================================
-- SECTION 10 — Recreate the public-search partial index
-- ============================================================
-- The original predicate was:
--     WHERE is_active = true AND deleted_at IS NULL
--       AND property_status IN ('AVAILABLE', 'UNDER_OFFER')
--
-- Both boolean/timestamp columns are gone. `listing_status = 'PUBLISHED'`
-- is the strict replacement: DRAFT, PAUSED, EXPIRED, REJECTED and
-- DELETED listings are all excluded, so this index covers strictly
-- more than the old one did.
--
-- This stays as raw SQL because Prisma's partial index `where` clause
-- supports only equality and `not` — not `in`.
CREATE INDEX IF NOT EXISTS "properties_public_search_idx"
  ON "properties" ("created_at" DESC)
  WHERE "listing_status" = 'PUBLISHED'
    AND "property_status" IN ('AVAILABLE', 'UNDER_OFFER');


-- ============================================================
-- SECTION 11 — PropertyVariant partial indexes
-- ============================================================
-- These two existed as raw SQL from the earlier search-performance
-- migration and tuned the LATERAL "cheapest active variant" query.
--
-- Enabling previewFeatures = ["partialIndexes"] made Prisma aware of
-- existing partial indexes, which meant it started treating these as
-- drift and DELETING them. They are declared in the Prisma schema now
-- instead, so Prisma manages them and they cannot silently vanish.

CREATE INDEX IF NOT EXISTS "property_variants_property_price_active_idx"
  ON "property_variants" ("property_id", "price")
  WHERE "is_active" = true;

CREATE INDEX IF NOT EXISTS "property_variants_property_bedrooms_active_idx"
  ON "property_variants" ("property_id", "bedrooms")
  WHERE "is_active" = true;


-- ============================================================
-- SECTION 12 — Data integrity backfill: buyer profiles
-- ============================================================
-- Agreed rule: EVERY registered user is a buyer
-- (User + Person + BuyerProfile created in one transaction).
--
-- The live data has 3 users with no BuyerProfile:
--   • 2 individual sellers (estatehub@, skyline@)
--   • 1 platform Super Admin (admin@ambrhomes.com)
--
-- Backfilled here so the invariant holds for existing data. New
-- registrations are fixed in the service layer (Phase 3) — a schema
-- migration cannot guarantee it.
INSERT INTO "buyer_profiles" ("id", "user_id", "buyer_status", "preferences", "created_at", "updated_at")
SELECT gen_random_uuid(), u."id", 'ACTIVE', '{}'::jsonb, NOW(), NOW()
  FROM "users" u
 WHERE NOT EXISTS (SELECT 1 FROM "buyer_profiles" b WHERE b."user_id" = u."id")
ON CONFLICT DO NOTHING;

-- NOTE: 3 users are also missing a Person row (the two seller accounts
-- and, historically, the admin). A Person needs a first name, which a
-- migration cannot invent — those are reported for manual completion
-- rather than faked with placeholder names.
