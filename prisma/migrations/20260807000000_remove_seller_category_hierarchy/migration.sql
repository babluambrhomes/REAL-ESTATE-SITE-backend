-- DropForeignKey
ALTER TABLE "seller_categories" DROP CONSTRAINT "seller_categories_parent_id_fkey";

-- DropIndex
DROP INDEX "seller_categories_parent_id_idx";

-- AlterTable
ALTER TABLE "seller_categories"
DROP COLUMN "icon",
DROP COLUMN "parent_id",
DROP COLUMN "display_order",
ADD COLUMN "image_url" TEXT;
