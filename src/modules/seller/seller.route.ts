import { Router } from "express";
import {
  becomeSeller,
  getCategories,
  getMyProfile,
  updateMyProfile,
  updateMySlug,
  updateLogo,
  updateCover,
  getPublicProfile,
} from "./seller.controller";
import { protect, checkSeller, validate, upload } from "../../middlewares";
import {
  becomeSellerSchema,
  updateSellerSchema,
  updateSlugSchema,
} from "./seller.validation";

const router = Router();

router.get("/categories", getCategories);

router.post("/become-seller", protect, validate(becomeSellerSchema), becomeSeller);

router.get("/me", protect, checkSeller, getMyProfile);
router.put("/me", protect, checkSeller, validate(updateSellerSchema), updateMyProfile);
router.patch("/me/slug", protect, checkSeller, validate(updateSlugSchema), updateMySlug);
router.put("/me/logo", protect, checkSeller, upload.single("logo"), updateLogo);
router.put("/me/cover", protect, checkSeller, upload.single("cover"), updateCover);

router.get("/:slug", getPublicProfile);

export default router;
