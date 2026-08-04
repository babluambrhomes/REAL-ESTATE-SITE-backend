/*
  Warnings:

  - You are about to drop the column `address_line` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `category_id` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `logo_url` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `pincode` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the `organization_categories` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[reference_code]` on the table `seller_profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `seller_profiles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `reference_code` to the `seller_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `seller_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'VILLA', 'PLOT', 'COMMERCIAL_SHOP', 'COMMERCIAL_OFFICE', 'COMMERCIAL_BUILDING', 'FARM_HOUSE', 'PENTHOUSE', 'STUDIO');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'UNDER_OFFER', 'SOLD', 'RENTED', 'LEASED', 'WITHDRAWN', 'DRAFT');

-- CreateEnum
CREATE TYPE "FurnishingStatus" AS ENUM ('FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('FREEHOLD', 'LEASEHOLD', 'CO_OPERATIVE');

-- CreateEnum
CREATE TYPE "ListedBy" AS ENUM ('OWNER', 'AGENT', 'BUILDER');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('READY_TO_MOVE', 'UNDER_CONSTRUCTION', 'NEW_LAUNCH');

-- CreateEnum
CREATE TYPE "SellerDocumentType" AS ENUM ('PAN_CARD', 'AADHAAR_CARD', 'GST_CERTIFICATE', 'COMPANY_REGISTRATION', 'RERA_CERTIFICATE', 'OFFICE_ADDRESS_PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "RatingStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BlogStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SellerBlogInteractionType" AS ENUM ('LIKE', 'DISLIKE', 'COMMENT');

-- CreateEnum
CREATE TYPE "BlogCommentStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

-- DropForeignKey
ALTER TABLE "organization_categories" DROP CONSTRAINT "organization_categories_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_category_id_fkey";

-- DropIndex
DROP INDEX "organizations_slug_key";

-- DropIndex
DROP INDEX "seller_profiles_user_id_idx";

-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "address_line",
DROP COLUMN "category_id",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "logo_url",
DROP COLUMN "pincode",
DROP COLUMN "slug",
DROP COLUMN "state",
ADD COLUMN     "employee_count" INTEGER,
ADD COLUMN     "gst_number" TEXT,
ADD COLUMN     "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by" UUID,
ADD COLUMN     "year_established" INTEGER;

-- AlterTable
ALTER TABLE "seller_profiles" ADD COLUMN     "aadhaar_number" TEXT,
ADD COLUMN     "about" TEXT,
ADD COLUMN     "achievements" JSONB DEFAULT '[]',
ADD COLUMN     "address_line" TEXT,
ADD COLUMN     "availability_details" JSONB DEFAULT '{}',
ADD COLUMN     "bank_approval_list" JSONB DEFAULT '[]',
ADD COLUMN     "category_id" UUID,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "cover_photo_url" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "experience_years" INTEGER,
ADD COLUMN     "happy_clients_count" INTEGER DEFAULT 0,
ADD COLUMN     "headline" TEXT,
ADD COLUMN     "is_available" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "languages" JSONB DEFAULT '[]',
ADD COLUMN     "leadPreferences" JSONB DEFAULT '{}',
ADD COLUMN     "locations" JSONB DEFAULT '[]',
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "organization_verification_status" "VerificationStatus",
ADD COLUMN     "organization_verified_at" TIMESTAMP(3),
ADD COLUMN     "organization_verified_by" UUID,
ADD COLUMN     "pan_number" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "reference_code" TEXT NOT NULL,
ADD COLUMN     "rera_number" TEXT,
ADD COLUMN     "response_time_minutes" INTEGER,
ADD COLUMN     "show_contact_to_buyers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "socialLinks" JSONB DEFAULT '[]',
ADD COLUMN     "specializations" JSONB DEFAULT '[]',
ADD COLUMN     "state" TEXT,
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by" UUID,
ADD COLUMN     "videos" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- DropTable
DROP TABLE "organization_categories";

-- CreateTable
CREATE TABLE "seller_blog_interactions" (
    "id" UUID NOT NULL,
    "blog_post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "SellerBlogInteractionType" NOT NULL,
    "content" TEXT,
    "parent_id" UUID,
    "status" "BlogCommentStatus" DEFAULT 'PENDING',
    "reaction_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_blog_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_blog_posts" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "cover_image" TEXT,
    "images" JSONB DEFAULT '[]',
    "tags" JSONB DEFAULT '[]',
    "meta_title" TEXT,
    "meta_description" TEXT,
    "meta_keywords" TEXT,
    "status" "BlogStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "seller_blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "parent_id" UUID,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_enquiries" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "user_id" UUID,
    "property_id" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_faqs" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_follows" (
    "id" UUID NOT NULL,
    "follower_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_ratings" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "RatingStatus" NOT NULL DEFAULT 'PENDING',
    "moderation_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_verification_documents" (
    "id" UUID NOT NULL,
    "seller_id" UUID,
    "organization_id" UUID,
    "doc_type" "SellerDocumentType" NOT NULL,
    "title" TEXT,
    "file_url" TEXT NOT NULL,
    "original_name" TEXT,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "verified_by" UUID,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "property_code" SERIAL NOT NULL,
    "seller_id" UUID NOT NULL,
    "organization_id" UUID,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "transaction_type" "TransactionType" NOT NULL,
    "property_type" "PropertyType" NOT NULL,
    "property_status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "address_line" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pincode" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "google_map_link" TEXT,
    "ownership_type" "OwnershipType",
    "listed_by" "ListedBy" NOT NULL DEFAULT 'OWNER',
    "age_of_property" INTEGER,
    "amenities" JSONB DEFAULT '[]',
    "nearby_places" JSONB DEFAULT '[]',
    "society_info" JSONB DEFAULT '{}',
    "images" JSONB DEFAULT '[]',
    "video_url" TEXT,
    "virtual_tour_url" TEXT,
    "rera_number" TEXT,
    "registration_number" TEXT,
    "tax_assessment" TEXT,
    "encumbrance" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "shares_count" INTEGER NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "average_rating" DECIMAL(3,2),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by" UUID,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "meta_keywords" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_faqs" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_likes" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_ratings" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "RatingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_variants" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "variant_name" TEXT NOT NULL,
    "variant_code" SERIAL NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "balconies" INTEGER,
    "price" DECIMAL(12,2) NOT NULL,
    "mrp_price" DECIMAL(12,2),
    "price_per_sqft" DECIMAL(12,2),
    "total_area" DECIMAL(12,2) NOT NULL,
    "total_area_unit" TEXT NOT NULL,
    "carpet_area" DECIMAL(12,2),
    "carpet_area_unit" TEXT,
    "super_built_up_area" DECIMAL(12,2),
    "super_built_up_area_unit" TEXT,
    "plot_area" DECIMAL(12,2),
    "plot_area_unit" TEXT,
    "floor_number" INTEGER,
    "total_floors" INTEGER,
    "availability_status" "AvailabilityStatus",
    "possession_date" DATE,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "inventory_count" INTEGER NOT NULL DEFAULT 0,
    "furnishing_status" "FurnishingStatus",
    "furnishing_items" JSONB DEFAULT '[]',
    "images" JSONB DEFAULT '[]',
    "brochure" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_blog_interactions_reaction_key_key" ON "seller_blog_interactions"("reaction_key");

-- CreateIndex
CREATE INDEX "seller_blog_interactions_blog_post_id_type_idx" ON "seller_blog_interactions"("blog_post_id", "type");

-- CreateIndex
CREATE INDEX "seller_blog_interactions_parent_id_idx" ON "seller_blog_interactions"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_blog_posts_slug_key" ON "seller_blog_posts"("slug");

-- CreateIndex
CREATE INDEX "seller_blog_posts_seller_id_status_idx" ON "seller_blog_posts"("seller_id", "status");

-- CreateIndex
CREATE INDEX "seller_blog_posts_author_id_idx" ON "seller_blog_posts"("author_id");

-- CreateIndex
CREATE INDEX "seller_blog_posts_slug_idx" ON "seller_blog_posts"("slug");

-- CreateIndex
CREATE INDEX "seller_blog_posts_published_at_idx" ON "seller_blog_posts"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "seller_categories_slug_key" ON "seller_categories"("slug");

-- CreateIndex
CREATE INDEX "seller_categories_parent_id_idx" ON "seller_categories"("parent_id");

-- CreateIndex
CREATE INDEX "seller_categories_is_active_idx" ON "seller_categories"("is_active");

-- CreateIndex
CREATE INDEX "seller_enquiries_seller_id_status_idx" ON "seller_enquiries"("seller_id", "status");

-- CreateIndex
CREATE INDEX "seller_enquiries_user_id_idx" ON "seller_enquiries"("user_id");

-- CreateIndex
CREATE INDEX "seller_enquiries_property_id_idx" ON "seller_enquiries"("property_id");

-- CreateIndex
CREATE INDEX "seller_faqs_seller_id_idx" ON "seller_faqs"("seller_id");

-- CreateIndex
CREATE INDEX "seller_follows_seller_id_idx" ON "seller_follows"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_follows_follower_id_seller_id_key" ON "seller_follows"("follower_id", "seller_id");

-- CreateIndex
CREATE INDEX "seller_ratings_seller_id_status_idx" ON "seller_ratings"("seller_id", "status");

-- CreateIndex
CREATE INDEX "seller_ratings_buyer_id_idx" ON "seller_ratings"("buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_ratings_seller_id_buyer_id_key" ON "seller_ratings"("seller_id", "buyer_id");

-- CreateIndex
CREATE INDEX "seller_verification_documents_seller_id_status_idx" ON "seller_verification_documents"("seller_id", "status");

-- CreateIndex
CREATE INDEX "seller_verification_documents_organization_id_status_idx" ON "seller_verification_documents"("organization_id", "status");

-- CreateIndex
CREATE INDEX "seller_verification_documents_doc_type_idx" ON "seller_verification_documents"("doc_type");

-- CreateIndex
CREATE UNIQUE INDEX "seller_verification_documents_seller_id_doc_type_key" ON "seller_verification_documents"("seller_id", "doc_type");

-- CreateIndex
CREATE UNIQUE INDEX "seller_verification_documents_organization_id_doc_type_key" ON "seller_verification_documents"("organization_id", "doc_type");

-- CreateIndex
CREATE UNIQUE INDEX "properties_property_code_key" ON "properties"("property_code");

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE INDEX "properties_seller_id_idx" ON "properties"("seller_id");

-- CreateIndex
CREATE INDEX "properties_organization_id_idx" ON "properties"("organization_id");

-- CreateIndex
CREATE INDEX "properties_property_type_idx" ON "properties"("property_type");

-- CreateIndex
CREATE INDEX "properties_transaction_type_idx" ON "properties"("transaction_type");

-- CreateIndex
CREATE INDEX "properties_property_status_idx" ON "properties"("property_status");

-- CreateIndex
CREATE INDEX "properties_city_idx" ON "properties"("city");

-- CreateIndex
CREATE INDEX "properties_state_idx" ON "properties"("state");

-- CreateIndex
CREATE INDEX "properties_is_featured_idx" ON "properties"("is_featured");

-- CreateIndex
CREATE INDEX "properties_is_active_idx" ON "properties"("is_active");

-- CreateIndex
CREATE INDEX "properties_is_verified_idx" ON "properties"("is_verified");

-- CreateIndex
CREATE INDEX "properties_deleted_at_idx" ON "properties"("deleted_at");

-- CreateIndex
CREATE INDEX "properties_property_code_idx" ON "properties"("property_code");

-- CreateIndex
CREATE INDEX "property_faqs_property_id_idx" ON "property_faqs"("property_id");

-- CreateIndex
CREATE INDEX "property_likes_property_id_idx" ON "property_likes"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_likes_user_id_property_id_key" ON "property_likes"("user_id", "property_id");

-- CreateIndex
CREATE INDEX "property_ratings_property_id_status_idx" ON "property_ratings"("property_id", "status");

-- CreateIndex
CREATE INDEX "property_ratings_user_id_idx" ON "property_ratings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_ratings_property_id_user_id_key" ON "property_ratings"("property_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_variants_variant_code_key" ON "property_variants"("variant_code");

-- CreateIndex
CREATE INDEX "property_variants_property_id_is_active_idx" ON "property_variants"("property_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "property_variants_property_id_variant_name_key" ON "property_variants"("property_id", "variant_name");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_reference_code_key" ON "seller_profiles"("reference_code");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_slug_key" ON "seller_profiles"("slug");

-- CreateIndex
CREATE INDEX "seller_profiles_category_id_idx" ON "seller_profiles"("category_id");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "seller_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_organization_verified_by_fkey" FOREIGN KEY ("organization_verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_blog_interactions" ADD CONSTRAINT "seller_blog_interactions_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "seller_blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_blog_interactions" ADD CONSTRAINT "seller_blog_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_blog_interactions" ADD CONSTRAINT "seller_blog_interactions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "seller_blog_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_blog_posts" ADD CONSTRAINT "seller_blog_posts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_blog_posts" ADD CONSTRAINT "seller_blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_categories" ADD CONSTRAINT "seller_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "seller_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_enquiries" ADD CONSTRAINT "seller_enquiries_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_enquiries" ADD CONSTRAINT "seller_enquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_enquiries" ADD CONSTRAINT "seller_enquiries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_faqs" ADD CONSTRAINT "seller_faqs_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_follows" ADD CONSTRAINT "seller_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_follows" ADD CONSTRAINT "seller_follows_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_ratings" ADD CONSTRAINT "seller_ratings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_ratings" ADD CONSTRAINT "seller_ratings_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_verification_documents" ADD CONSTRAINT "seller_verification_documents_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_verification_documents" ADD CONSTRAINT "seller_verification_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_verification_documents" ADD CONSTRAINT "seller_verification_documents_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_faqs" ADD CONSTRAINT "property_faqs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_likes" ADD CONSTRAINT "property_likes_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_likes" ADD CONSTRAINT "property_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_ratings" ADD CONSTRAINT "property_ratings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_ratings" ADD CONSTRAINT "property_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_variants" ADD CONSTRAINT "property_variants_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
