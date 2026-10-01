import { Router } from "express";
import {
  bookSiteVisit,
  listMySiteVisits,
  getMySiteVisit,
  rescheduleMySiteVisit,
  cancelMySiteVisit,
  listSellerSiteVisits,
  getSellerSiteVisitStats,
  getSellerSiteVisit,
  updateSiteVisitStatus,
  rescheduleSellerSiteVisit,
  updateSiteVisitComment,
  deleteSiteVisit,
} from "./siteVisit.controller";
import { protect, checkSeller, validate, parseQuery } from "../../middlewares";
import {
  bookSiteVisitSchema,
  listSiteVisitsQuerySchema,
  rescheduleSiteVisitSchema,
  cancelSiteVisitSchema,
  updateSiteVisitStatusSchema,
  updateSiteVisitCommentSchema,
  siteVisitIdParamsSchema,
} from "./siteVisit.validation";

// :id UUID hona zaroori hai — warna Prisma raw error dega
const validateId = validate(siteVisitIdParamsSchema, "params");

const router = Router();

// --- Buyer: visit book kare (login compulsory, koi bhi future time) ---
router.post("/", protect, validate(bookSiteVisitSchema), bookSiteVisit);

// --- Buyer: apni site visits ---
const me = Router();
me.use(protect);

me.get("/", parseQuery(listSiteVisitsQuerySchema), listMySiteVisits);
me.get("/:id", validateId, getMySiteVisit);
me.patch("/:id/reschedule", validateId, validate(rescheduleSiteVisitSchema), rescheduleMySiteVisit);
me.patch("/:id/cancel", validateId, validate(cancelSiteVisitSchema), cancelMySiteVisit);

router.use("/me", me);

// --- Seller: apni site visits manage kare ---
const seller = Router();
seller.use(protect);
seller.use(checkSeller);

seller.get("/", parseQuery(listSiteVisitsQuerySchema), listSellerSiteVisits);
seller.get("/stats", getSellerSiteVisitStats);
seller.get("/:id", validateId, getSellerSiteVisit);
seller.patch("/:id/status", validateId, validate(updateSiteVisitStatusSchema), updateSiteVisitStatus);
seller.patch(
  "/:id/reschedule",
  validateId,
  validate(rescheduleSiteVisitSchema),
  rescheduleSellerSiteVisit
);
seller.put("/:id/comment", validateId, validate(updateSiteVisitCommentSchema), updateSiteVisitComment);
seller.delete("/:id", validateId, deleteSiteVisit);

router.use("/seller", seller);

export default router;
