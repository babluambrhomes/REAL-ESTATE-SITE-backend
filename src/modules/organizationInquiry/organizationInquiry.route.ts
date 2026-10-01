import { Router } from "express";
import {
  createInquiry,
  listInquiries,
  getInquiry,
  getInquiryStats,
  updateInquiryStatus,
  updateInquiryComment,
  assignInquiry,
  deleteInquiry,
} from "./organizationInquiry.controller";
import {
  protect,
  checkOrgMember,
  validate,
  parseQuery,
  leadRateLimit,
} from "../../middlewares";
import {
  createInquirySchema,
  updateInquiryStatusSchema,
  updateInquiryCommentSchema,
  assignInquirySchema,
  listInquiriesQuerySchema,
  orgIdParamsSchema,
  inquiryParamsSchema,
} from "./organizationInquiry.validation";

const router = Router();

const validateOrgId = validate(orgIdParamsSchema, "params");
const validateParams = validate(inquiryParamsSchema, "params");

// --- Buyer: org ke "Interested in this organization?" form ---
// Login compulsory (a logged-out visitor's name/phone cannot be trusted), and
// rate limited because this is an unauthenticated-cost public endpoint.
router.post("/", protect, validateOrgId, leadRateLimit, validate(createInquirySchema), createInquiry);

// --- Org side: inquiry inbox ---
// checkOrgMember resolves :orgId against the caller's ACTIVE membership and
// refuses a caller who belongs to several orgs unless one is named — so a
// member of two companies cannot guess which inbox they are reading.
const me = Router();
me.use(protect);
me.use(checkOrgMember);
me.use(validateOrgId);

me.get("/", parseQuery(listInquiriesQuerySchema), listInquiries);
me.get("/stats", getInquiryStats);
me.get("/:id", validateParams, getInquiry);
me.patch("/:id/status", validateParams, validate(updateInquiryStatusSchema), updateInquiryStatus);
me.put("/:id/comment", validateParams, validate(updateInquiryCommentSchema), updateInquiryComment);
me.patch("/:id/assign", validateParams, validate(assignInquirySchema), assignInquiry);
me.delete("/:id", validateParams, deleteInquiry);

router.use("/me", me);

export default router;
