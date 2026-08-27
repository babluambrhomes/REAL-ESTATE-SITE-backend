CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "AccountOrigin" AS ENUM ('SELF_REGISTERED', 'INVITED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('ORGANIZATION', 'PLATFORM');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('ORGANIZATION', 'PLATFORM');

-- CreateEnum
CREATE TYPE "MemberScope" AS ENUM ('ORGANIZATION', 'PLATFORM');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "InvitationType" AS ENUM ('ORGANIZATION_MEMBER', 'PLATFORM_STAFF');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'LOGIN_2FA', 'LOGIN_PASSWORDLESS', 'ACCOUNT_DELETION');

-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'ROTATED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'VILLA', 'BUILDER_FLOOR', 'PENTHOUSE', 'STUDIO', 'PLOT', 'AGRICULTURAL_LAND', 'FARM_HOUSE', 'COMMERCIAL_SHOP', 'COMMERCIAL_OFFICE', 'COMMERCIAL_BUILDING', 'SHOWROOM', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SALE', 'RENT', 'LEASE');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'UNDER_OFFER', 'SOLD', 'RENTED', 'LEASED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FurnishingStatus" AS ENUM ('FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('FREEHOLD', 'LEASEHOLD', 'CO_OPERATIVE', 'POWER_OF_ATTORNEY');

-- CreateEnum
CREATE TYPE "ListedBy" AS ENUM ('OWNER', 'AGENT', 'BUILDER');

-- CreateEnum
CREATE TYPE "ConstructionStatus" AS ENUM ('READY_TO_MOVE', 'UNDER_CONSTRUCTION', 'NEW_LAUNCH');

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

-- CreateTable
CREATE TABLE "buyer_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "preferences" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "invitation_type" "InvitationType" NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "token" TEXT NOT NULL,
    "invited_by" UUID NOT NULL,
    "organization_id" UUID,
    "role_id" UUID NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "accepted_by" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "scope" "MemberScope" NOT NULL,
    "context_id" UUID,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "date_of_birth" DATE,
    "gender" "Gender",
    "address_line" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pincode" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otps" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "identifier" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "status" "OtpStatus" NOT NULL DEFAULT 'ACTIVE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "resent_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "family" TEXT NOT NULL,
    "device_info" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "replaced_by_token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "googleId" TEXT,
    "hasPassword" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "account_origin" "AccountOrigin" NOT NULL DEFAULT 'SELF_REGISTERED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "registration_number" TEXT,
    "website" TEXT,
    "gst_number" TEXT,
    "year_established" INTEGER,
    "employee_count" INTEGER,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMP(3),
    "verified_by" UUID,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "property_code" TEXT NOT NULL,
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
    "geog" geography,
    "searchVector" tsvector,
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
    "variant_code" TEXT NOT NULL,
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
    "construction_status" "ConstructionStatus",
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

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "scope" "PermissionScope" NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "scope" "RoleScope" NOT NULL,
    "context_id" UUID,
    "role_name" TEXT NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reference_code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "seller_type" "SellerType" NOT NULL,
    "organization_id" UUID,
    "category_id" UUID,
    "pan_number" TEXT,
    "aadhaar_number" TEXT,
    "rera_number" TEXT,
    "headline" TEXT,
    "about" TEXT,
    "experience_years" INTEGER,
    "specializations" JSONB DEFAULT '[]',
    "languages" JSONB DEFAULT '[]',
    "logo_url" TEXT,
    "cover_photo_url" TEXT,
    "address_line" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pincode" TEXT,
    "happy_clients_count" INTEGER DEFAULT 0,
    "response_time_minutes" INTEGER,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "availability_details" JSONB DEFAULT '{}',
    "videos" JSONB DEFAULT '[]',
    "locations" JSONB DEFAULT '[]',
    "bank_approval_list" JSONB DEFAULT '[]',
    "achievements" JSONB DEFAULT '[]',
    "socialLinks" JSONB DEFAULT '[]',
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "show_contact_to_buyers" BOOLEAN NOT NULL DEFAULT false,
    "leadPreferences" JSONB DEFAULT '{}',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMP(3),
    "verified_by" UUID,
    "organization_verification_status" "VerificationStatus",
    "organization_verified_at" TIMESTAMP(3),
    "organization_verified_by" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

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
    "image_url" TEXT,
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

-- CreateIndex
CREATE UNIQUE INDEX "buyer_profiles_user_id_key" ON "buyer_profiles"("user_id");

-- CreateIndex
CREATE INDEX "buyer_profiles_user_id_idx" ON "buyer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_status_idx" ON "invitations"("status");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_invited_by_idx" ON "invitations"("invited_by");

-- CreateIndex
CREATE INDEX "invitations_organization_id_idx" ON "invitations"("organization_id");

-- CreateIndex
CREATE INDEX "members_user_id_idx" ON "members"("user_id");

-- CreateIndex
CREATE INDEX "members_role_id_idx" ON "members"("role_id");

-- CreateIndex
CREATE INDEX "members_context_id_idx" ON "members"("context_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_scope_context_id_user_id_key" ON "members"("scope", "context_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "persons_user_id_key" ON "persons"("user_id");

-- CreateIndex
CREATE INDEX "persons_user_id_idx" ON "persons"("user_id");

-- CreateIndex
CREATE INDEX "otps_identifier_purpose_status_idx" ON "otps"("identifier", "purpose", "status");

-- CreateIndex
CREATE INDEX "otps_user_id_purpose_status_idx" ON "otps"("user_id", "purpose", "status");

-- CreateIndex
CREATE INDEX "otps_user_id_idx" ON "otps"("user_id");

-- CreateIndex
CREATE INDEX "otps_expires_at_idx" ON "otps"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_status_idx" ON "refresh_tokens"("user_id", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens"("family");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "organizations_created_by_idx" ON "organizations"("created_by");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

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
CREATE INDEX "permissions_scope_idx" ON "permissions"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_scope_resource_action_key" ON "permissions"("scope", "resource", "action");

-- CreateIndex
CREATE INDEX "roles_context_id_idx" ON "roles"("context_id");

-- CreateIndex
CREATE INDEX "roles_created_by_idx" ON "roles"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "roles_scope_context_id_role_name_key" ON "roles"("scope", "context_id", "role_name");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_user_id_key" ON "seller_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_reference_code_key" ON "seller_profiles"("reference_code");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_slug_key" ON "seller_profiles"("slug");

-- CreateIndex
CREATE INDEX "seller_profiles_organization_id_idx" ON "seller_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "seller_profiles_category_id_idx" ON "seller_profiles"("category_id");

-- CreateIndex
CREATE INDEX "seller_profiles_verification_status_idx" ON "seller_profiles"("verification_status");

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

-- AddForeignKey
ALTER TABLE "buyer_profiles" ADD CONSTRAINT "buyer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otps" ADD CONSTRAINT "otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
