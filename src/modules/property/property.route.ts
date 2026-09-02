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
  togglePropertyActive,
} from "./property.controller";
import { toggleWishlist } from "../propertyWishlist/propertyWishlist.controller";
import { getBrochure } from "./brochure.controller";
import {
  protect,
  checkSeller,
  checkSellerVerified,
  authorizePlatformRole,
  validate,
  upload,
} from "../../middlewares";
import {
  createPropertySchema,
  updatePropertySchema,
  updatePropertyStatusSchema,
  createVariantSchema,
  updateVariantSchema,
  verifyPropertySchema,
  toggleActiveSchema,
  setImagesSchema,
  removeImageSchema,
} from "./property.validation";

const router = Router();

router.get("/", listProperties);

router.get("/my", protect, checkSeller, getMyProperties);
router.get("/my/:id", protect, checkSeller, getMyProperty);

router.post("/", protect, checkSellerVerified, validate(createPropertySchema), createProperty);

router.patch("/:id", protect, checkSellerVerified, validate(updatePropertySchema), updateProperty);
router.patch("/:id/status", protect, checkSellerVerified, validate(updatePropertyStatusSchema), updatePropertyStatus);
router.delete("/:id", protect, checkSellerVerified, deleteProperty);

router.post("/:id/images", protect, checkSellerVerified, upload.array("images", 10), uploadImages);
router.put("/:id/images", protect, checkSellerVerified, validate(setImagesSchema), setImages);
router.delete("/:id/images", protect, checkSellerVerified, validate(removeImageSchema), removeImages);

router.post("/:id/variants", protect, checkSellerVerified, validate(createVariantSchema), addVariant);
router.patch("/:id/variants/:variantId", protect, checkSellerVerified, validate(updateVariantSchema), updateVariant);
router.delete("/:id/variants/:variantId", protect, checkSellerVerified, deleteVariant);
router.post(
  "/:id/variants/:variantId/images",
  protect,
  checkSellerVerified,
  upload.array("images", 10),
  uploadVariantImages
);

router.get("/:id/variants/:variantId/brochure", protect, getBrochure);

router.get("/admin", protect, authorizePlatformRole("Super Admin", "Staff"), adminListProperties);
router.patch("/:id/verify", protect, authorizePlatformRole("Super Admin", "Staff"), validate(verifyPropertySchema), verifyProperty);
router.patch("/:id/toggle-active", protect, authorizePlatformRole("Super Admin", "Staff"), validate(toggleActiveSchema), togglePropertyActive);



router.get("/:slug", getPublicProperty);

export default router;
