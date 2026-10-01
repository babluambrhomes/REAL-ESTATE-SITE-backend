import { Router } from "express";
import {
  createLead,
  listLeads,
  getLeadStats,
  getLead,
  updateLeadStatus,
  updateLeadComment,
  deleteLead,
} from "./leadForm.controller";
import { protect, checkSeller, validate, parseQuery, leadRateLimit } from "../../middlewares";
import {
  createLeadSchema,
  updateLeadStatusSchema,
  updateLeadCommentSchema,
  listLeadsQuerySchema,
  leadIdParamsSchema,
} from "./leadForm.validation";

// :id UUID hona zaroori hai — warna Prisma raw error dega
const validateId = validate(leadIdParamsSchema, "params");

const router = Router();

// --- Public-side: lead create (login compulsory + rate-limited) ---
router.post("/", protect, leadRateLimit, validate(createLeadSchema), createLead);

// --- Seller: apne leads manage kare ---
const me = Router();
me.use(protect);
me.use(checkSeller);

me.get("/", parseQuery(listLeadsQuerySchema), listLeads);
me.get("/stats", getLeadStats);
me.get("/:id", validateId, getLead);
me.patch("/:id/status", validateId, validate(updateLeadStatusSchema), updateLeadStatus);
me.put("/:id/comment", validateId, validate(updateLeadCommentSchema), updateLeadComment);
me.delete("/:id", validateId, deleteLead);

router.use("/me", me);

export default router;