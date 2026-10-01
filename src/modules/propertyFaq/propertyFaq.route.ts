import { Router } from "express";
import {
  createFaq,
  listFaqs,
  getFaq,
  updateFaq,
  deleteFaq,
  reorderFaqs,
} from "./propertyFaq.controller";
import { protect, checkSeller, checkSellerVerified, validate } from "../../middlewares";
import {
  createFaqSchema,
  updateFaqSchema,
  reorderFaqsSchema,
  listFaqsQuerySchema,
  faqIdParamsSchema,
} from "./propertyFaq.validation";

const router = Router();

// :id UUID hona chahiye — warna Prisma raw error dekar 500 jayega
const validateId = validate(faqIdParamsSchema, "params");

// --- Seller: apni property ke against FAQ manage kare ---
// Note: PATCH /reorder ko /:id se PEHLE register karna zaroori hai,
// warna "reorder" string ko :id samajh liya jayega aur UUID validation fail hogi.
router.post("/", protect, checkSellerVerified, validate(createFaqSchema), createFaq);
router.patch("/reorder", protect, checkSellerVerified, validate(reorderFaqsSchema), reorderFaqs);

router.get("/", protect, checkSeller, validate(listFaqsQuerySchema, "query"), listFaqs);
router.get("/:id", protect, checkSeller, validateId, getFaq);
router.patch("/:id", protect, checkSellerVerified, validateId, validate(updateFaqSchema), updateFaq);
router.delete("/:id", protect, checkSellerVerified, validateId, deleteFaq);

export default router;
