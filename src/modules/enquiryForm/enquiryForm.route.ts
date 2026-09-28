import { Router } from "express";
import {
  submitEnquiry,
  listEnquiries,
  getEnquiryStats,
  getEnquiry,
  updateEnquiryStatus,
  updateEnquiryComment,
  deleteEnquiry,
} from "./enquiryForm.controller";
import { protect, checkSeller, validate, optionalAuth } from "../../middlewares";
import {
  submitEnquirySchema,
  updateEnquiryStatusSchema,
  updateEnquiryCommentSchema,
  listEnquiriesQuerySchema,
} from "./enquiryForm.validation";

const router = Router();

// --- Public: koi bhi user enquiry form submit kare (optional: logged-in buyer link) ---
router.post("/", optionalAuth, validate(submitEnquirySchema), submitEnquiry);

// --- Seller: apne leads/enquiries manage kare ---
const me = Router();
me.use(protect);
me.use(checkSeller);

me.get("/", validate(listEnquiriesQuerySchema, "query"), listEnquiries);
me.get("/stats", getEnquiryStats);
me.get("/:id", getEnquiry);
me.patch("/:id/status", validate(updateEnquiryStatusSchema), updateEnquiryStatus);
me.put("/:id/comment", validate(updateEnquiryCommentSchema), updateEnquiryComment);
me.delete("/:id", deleteEnquiry);

router.use("/me", me);

export default router;