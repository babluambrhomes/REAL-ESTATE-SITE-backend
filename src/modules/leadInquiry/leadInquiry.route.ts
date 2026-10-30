import { Router } from "express";
import {
  createGeneralLead,
  createOrganizationInquiry,
  createSiteVisit,
  listMyLeadInquiries,
  getMyLeadInquiry,
  rescheduleMyLeadInquiry,
  cancelMyLeadInquiry,
  listManagedLeadInquiries,
  getManagedLeadInquiry,
  getManagedStats,
  updateStatus,
  addComment,
  assignLeadInquiry,
  rescheduleManagedLeadInquiry,
  cancelManagedLeadInquiry,
  deleteLeadInquiry,
} from "./leadInquiry.controller";
import { protect, checkSeller, validate, parseQuery, leadRateLimit } from "../../middlewares";
import {
  createGeneralLeadSchema,
  createOrganizationInquirySchema,
  createSiteVisitSchema,
  listLeadInquiriesQuerySchema,
  updateStatusSchema,
  addCommentSchema,
  assignSchema,
  rescheduleSchema,
  cancelSchema,
  leadInquiryIdParamsSchema,
} from "./leadInquiry.validation";

const validateId = validate(leadInquiryIdParamsSchema, "params");

const router = Router();

// --- Buyer: teen alag create endpoints (login compulsory + rate-limited) ---
router.post(
  "/general",
  protect,
  leadRateLimit,
  validate(createGeneralLeadSchema),
  createGeneralLead
);
router.post(
  "/organization-inquiry",
  protect,
  leadRateLimit,
  validate(createOrganizationInquirySchema),
  createOrganizationInquiry
);
router.post(
  "/site-visit",
  protect,
  leadRateLimit,
  validate(createSiteVisitSchema),
  createSiteVisit
);

// --- Buyer: apni inquiries ---
const me = Router();
me.use(protect);

me.get("/", parseQuery(listLeadInquiriesQuerySchema), listMyLeadInquiries);
me.get("/:id", validateId, getMyLeadInquiry);
me.patch("/:id/reschedule", validateId, validate(rescheduleSchema), rescheduleMyLeadInquiry);
me.patch("/:id/cancel", validateId, validate(cancelSchema), cancelMyLeadInquiry);

router.use("/me", me);

// --- Seller / organization: inbox manage ---
const manage = Router();
manage.use(protect);
manage.use(checkSeller);

manage.get("/", parseQuery(listLeadInquiriesQuerySchema), listManagedLeadInquiries);
manage.get("/stats", parseQuery(listLeadInquiriesQuerySchema), getManagedStats);
manage.get("/:id", validateId, getManagedLeadInquiry);
manage.patch("/:id/status", validateId, validate(updateStatusSchema), updateStatus);
manage.post("/:id/comments", validateId, validate(addCommentSchema), addComment);
manage.patch("/:id/assign", validateId, validate(assignSchema), assignLeadInquiry);
manage.patch(
  "/:id/reschedule",
  validateId,
  validate(rescheduleSchema),
  rescheduleManagedLeadInquiry
);
manage.patch("/:id/cancel", validateId, validate(cancelSchema), cancelManagedLeadInquiry);
manage.delete("/:id", validateId, deleteLeadInquiry);

router.use("/manage", manage);

export default router;
