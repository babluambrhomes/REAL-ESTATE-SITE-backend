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
  listPublicFaqs,
} from "./seller.controller";
import { protect, checkIndividualSeller, validate, upload } from "../../middlewares";
import {
  becomeSellerSchema,
  updateSellerSchema,
  updateSlugSchema,
} from "./seller.validation";

const router = Router();

router.get("/categories", getCategories);

router.post("/become-seller", protect, validate(becomeSellerSchema), becomeSeller);

/**
 * "My seller profile" is always the caller's OWN INDIVIDUAL profile.
 *
 * checkIndividualSeller, not checkSeller: an organization member has a
 * selling context but no individual profile, and these services look the
 * profile up by user id. Letting checkSeller through would admit org members
 * only for the service to reject them with "you are not registered as a
 * seller" — and worse, it would be ambiguous about whether they were about to
 * edit the company's public page.
 */
router.get("/me", protect, checkIndividualSeller, getMyProfile);
router.put("/me", protect, checkIndividualSeller, validate(updateSellerSchema), updateMyProfile);
router.patch("/me/slug", protect, checkIndividualSeller, validate(updateSlugSchema), updateMySlug);
router.put("/me/logo", protect, checkIndividualSeller, upload.single("logo"), updateLogo);
router.put("/me/cover", protect, checkIndividualSeller, upload.single("cover"), updateCover);

// Public: seller ke FAQ list (FAQ section lazy-load ke liye)
router.get("/:slug/faqs", listPublicFaqs);

router.get("/:slug", getPublicProfile);

export default router;
