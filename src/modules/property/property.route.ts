import { Router } from "express";
import {
  listProperties,
  getPublicProperty,
  getMyProperties,
  getMyProperty,
  createProperty,
  updateProperty,
  updatePropertyStatus,
  deleteProperty,
  uploadImages,
  setImages,
  removeImages,
  addVariant,
  updateVariant,
  deleteVariant,
  uploadVariantImages,
  adminListProperties,
  verifyProperty,
  setPropertyListingStatus,
} from "./property.controller";
import { toggleWishlist } from "../propertyWishlist/propertyWishlist.controller";
import { getBrochure } from "./brochure.controller";
import {
  protect,
  checkSeller,
  checkSellerVerified,
  checkSellerPermission,
  requirePermission,
  validate,
  upload,
} from "../../middlewares";
import { PermissionScope } from "../../generated/prisma/enums";
import {
  createPropertySchema,
  updatePropertySchema,
  updatePropertyStatusSchema,
  createVariantSchema,
  updateVariantSchema,
  verifyPropertySchema,
  setListingStatusSchema,
  setImagesSchema,
  removeImageSchema,
} from "./property.validation";

const router = Router();

const canReadProperty = checkSellerPermission("property:read");
const canCreateProperty = checkSellerPermission("property:create");
const canUpdateProperty = checkSellerPermission("property:update");
const canDeleteProperty = checkSellerPermission("property:delete");
const canPublishProperty = checkSellerPermission("property:publish");

router.get("/", listProperties);

router.get("/my", protect, checkSeller, canReadProperty, getMyProperties);
router.get("/my/:id", protect, checkSeller, canReadProperty, getMyProperty);

router.post("/", protect, checkSellerVerified, canCreateProperty, validate(createPropertySchema), createProperty);

router.patch("/:id", protect, checkSellerVerified, canUpdateProperty, validate(updatePropertySchema), updateProperty);
router.patch("/:id/status", protect, checkSellerVerified, canPublishProperty, validate(updatePropertyStatusSchema), updatePropertyStatus);
router.delete("/:id", protect, checkSellerVerified, canDeleteProperty, deleteProperty);

router.post("/:id/images", protect, checkSellerVerified, canUpdateProperty, upload.array("images", 10), uploadImages);
router.put("/:id/images", protect, checkSellerVerified, canUpdateProperty, validate(setImagesSchema), setImages);
router.delete("/:id/images", protect, checkSellerVerified, canUpdateProperty, validate(removeImageSchema), removeImages);

router.post("/:id/variants", protect, checkSellerVerified, canUpdateProperty, validate(createVariantSchema), addVariant);
router.patch("/:id/variants/:variantId", protect, checkSellerVerified, canUpdateProperty, validate(updateVariantSchema), updateVariant);
router.delete("/:id/variants/:variantId", protect, checkSellerVerified, canUpdateProperty, deleteVariant);
router.post(
  "/:id/variants/:variantId/images",
  protect,
  checkSellerVerified,
  canUpdateProperty,
  upload.array("images", 10),
  uploadVariantImages
);

router.get("/:id/variants/:variantId/brochure", protect, getBrochure);

router.get("/admin", protect, requirePermission(PermissionScope.PLATFORM, "property:read"), adminListProperties);
router.patch("/:id/verify", protect, requirePermission(PermissionScope.PLATFORM, "property:verify"), validate(verifyPropertySchema), verifyProperty);
router.patch("/:id/listing-status", protect, requirePermission(PermissionScope.PLATFORM, "property:update"), validate(setListingStatusSchema), setPropertyListingStatus);



router.get("/:slug", getPublicProperty);

export default router;
