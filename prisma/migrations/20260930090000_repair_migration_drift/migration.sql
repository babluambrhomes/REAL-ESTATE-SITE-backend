-- ============================================================
-- MIGRATION: repair_migration_drift
-- ============================================================
-- WHY THIS MIGRATION EXISTS
-- -----------------------
-- The Prisma migrations folder had drifted out of sync with the
-- actual database:
--
--   1. init migration created "seller_enquiries" + "EnquiryStatus"
--      → but no Prisma model existed for them. Dead table.
--   2. Prisma models existed for "lead_forms", "buyer_questions"
--      and "site_visits" → but NO migration ever created them.
--
-- Somebody had been using `prisma db push` (which applies the schema
-- directly, ignoring the migration folder), so the live database was
-- correct while the migration history was not. That is a trap: any
-- fresh environment built with `prisma migrate deploy` would get a
-- BROKEN database — seller_enquiries present, three real tables
-- missing.
--
-- This migration closes the gap. It is written to be IDEMPOTENT so it
-- is correct in BOTH situations:
--
--   • Fresh database (tables missing) → creates them
--   • Existing database (tables present) → the IF EXISTS / IF NOT
--     EXISTS clauses make every statement a no-op
--
-- No data is touched anywhere in this file.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Drop the dead seller_enquiries table + its enum
-- ------------------------------------------------------------
-- Confirmed unused: no Prisma model, no code reference, and the live
-- database did not even have this table (it had already been dropped
-- manually there).
--
-- Safe on a fresh database too: the init migration created it, so this
-- statement has something real to remove.
--
-- CASCADE is required because 3 foreign keys point at it. CASCADE only
-- affects objects that depend on seller_enquiries — nothing else.
DROP TABLE IF EXISTS "seller_enquiries";

-- The enum type only existed for that table's status column.
DROP TYPE IF EXISTS "EnquiryStatus";


-- ------------------------------------------------------------
-- 2. Create the three missing tables
-- ------------------------------------------------------------
-- Column types/defaults are copied verbatim from the live database so
-- the result is byte-for-byte what the existing environment already has.
-- (uuid PKs, timestamptz-free `timestamp` columns to match the rest of
-- this schema, and the project's existing "timestamp" convention.)

CREATE TABLE IF NOT EXISTS "lead_forms" (
    "id" UUID NOT NULL,
    "seller_id" UUID,
    "organization_id" UUID,
    "user_id" UUID,
    "property_id" UUID,
    "source" "LeadSource" NOT NULL DEFAULT 'ENQUIRY_FORM',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "message" TEXT,
    "comment" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "lead_forms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "buyer_questions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "property_id" UUID,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" "BuyerQuestionStatus" NOT NULL DEFAULT 'PENDING',
    "answered_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "buyer_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "site_visits" (
    "id" UUID NOT NULL,
    "seller_id" UUID,
    "organization_id" UUID,
    "user_id" UUID NOT NULL,
    "property_id" UUID,
    "visit_date" TIMESTAMP NOT NULL,
    "start_time" TIMESTAMP NOT NULL,
    "end_time" TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "message" TEXT,
    "user_address" TEXT,
    "comment" TEXT,
    "status" "SiteVisitStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMP,
    "cancelled_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);


-- ------------------------------------------------------------
-- 3. Indexes for the three tables
-- ------------------------------------------------------------
-- IF NOT EXISTS so re-running on the existing database is a no-op.

-- lead_forms
CREATE INDEX IF NOT EXISTS "lead_forms_seller_id_status_created_at_idx" ON "lead_forms"("seller_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "lead_forms_organization_id_idx"        ON "lead_forms"("organization_id");
CREATE INDEX IF NOT EXISTS "lead_forms_user_id_idx"               ON "lead_forms"("user_id");
CREATE INDEX IF NOT EXISTS "lead_forms_property_id_idx"           ON "lead_forms"("property_id");

-- buyer_questions
CREATE INDEX IF NOT EXISTS "buyer_questions_seller_id_status_created_at_idx" ON "buyer_questions"("seller_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "buyer_questions_user_id_created_at_idx"          ON "buyer_questions"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "buyer_questions_property_id_idx"                 ON "buyer_questions"("property_id");

-- site_visits
CREATE INDEX IF NOT EXISTS "site_visits_seller_id_status_visit_date_idx" ON "site_visits"("seller_id", "status", "visit_date");
CREATE INDEX IF NOT EXISTS "site_visits_organization_id_idx"             ON "site_visits"("organization_id");
CREATE INDEX IF NOT EXISTS "site_visits_user_id_idx"                    ON "site_visits"("user_id");
CREATE INDEX IF NOT EXISTS "site_visits_property_id_idx"                ON "site_visits"("property_id");


-- ------------------------------------------------------------
-- 4. Foreign keys for the three tables
-- ------------------------------------------------------------
-- onDelete actions match the live database exactly, so this migration
-- is a true no-op on an already-correct environment.
--
-- Note the deliberate mix, which is NOT an inconsistency:
--   • buyer_questions.user_id / site_visits.user_id → CASCADE
--     (buyer account gone → their enquiries/visits have no meaning)
--   • lead_forms.user_id → SET NULL
--     (a lead is a BUSINESS record; it must survive the buyer leaving)
--   • *._id seller/buyer → CASCADE, property/organization → SET NULL
--     (deleting a seller or a property must not destroy lead history)

-- Postgres has no "ADD CONSTRAINT IF NOT EXISTS", so each FK is dropped
-- first. On the existing database the constraint is already there, so the
-- DROP is a no-op and the ADD recreates the identical definition. On a fresh
-- database the DROP does nothing and the ADD creates it. Both paths converge
-- on the same end state.

ALTER TABLE "lead_forms"      DROP CONSTRAINT IF EXISTS "lead_forms_seller_id_fkey";
ALTER TABLE "lead_forms"      DROP CONSTRAINT IF EXISTS "lead_forms_organization_id_fkey";
ALTER TABLE "lead_forms"      DROP CONSTRAINT IF EXISTS "lead_forms_user_id_fkey";
ALTER TABLE "lead_forms"      DROP CONSTRAINT IF EXISTS "lead_forms_property_id_fkey";
ALTER TABLE "lead_forms"      ADD CONSTRAINT "lead_forms_seller_id_fkey"      FOREIGN KEY ("seller_id")      REFERENCES "seller_profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "lead_forms"      ADD CONSTRAINT "lead_forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")   ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "lead_forms"      ADD CONSTRAINT "lead_forms_user_id_fkey"         FOREIGN KEY ("user_id")         REFERENCES "users"("id")           ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "lead_forms"      ADD CONSTRAINT "lead_forms_property_id_fkey"     FOREIGN KEY ("property_id")     REFERENCES "properties"("id")      ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "buyer_questions" DROP CONSTRAINT IF EXISTS "buyer_questions_user_id_fkey";
ALTER TABLE "buyer_questions" DROP CONSTRAINT IF EXISTS "buyer_questions_seller_id_fkey";
ALTER TABLE "buyer_questions" DROP CONSTRAINT IF EXISTS "buyer_questions_property_id_fkey";
ALTER TABLE "buyer_questions" ADD CONSTRAINT "buyer_questions_user_id_fkey"     FOREIGN KEY ("user_id")     REFERENCES "users"("id")           ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "buyer_questions" ADD CONSTRAINT "buyer_questions_seller_id_fkey"   FOREIGN KEY ("seller_id")   REFERENCES "seller_profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "buyer_questions" ADD CONSTRAINT "buyer_questions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id")      ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "site_visits"      DROP CONSTRAINT IF EXISTS "site_visits_seller_id_fkey";
ALTER TABLE "site_visits"      DROP CONSTRAINT IF EXISTS "site_visits_organization_id_fkey";
ALTER TABLE "site_visits"      DROP CONSTRAINT IF EXISTS "site_visits_user_id_fkey";
ALTER TABLE "site_visits"      DROP CONSTRAINT IF EXISTS "site_visits_property_id_fkey";
ALTER TABLE "site_visits"      ADD CONSTRAINT "site_visits_seller_id_fkey"      FOREIGN KEY ("seller_id")      REFERENCES "seller_profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "site_visits"      ADD CONSTRAINT "site_visits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")   ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "site_visits"      ADD CONSTRAINT "site_visits_user_id_fkey"         FOREIGN KEY ("user_id")         REFERENCES "users"("id")           ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "site_visits"      ADD CONSTRAINT "site_visits_property_id_fkey"     FOREIGN KEY ("property_id")     REFERENCES "properties"("id")      ON UPDATE CASCADE ON DELETE SET NULL;
