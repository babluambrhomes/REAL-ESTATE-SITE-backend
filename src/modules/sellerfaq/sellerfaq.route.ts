import { Router } from "express";
import {
  listFaqs,
  getFaq,
  createFaq,
  updateFaq,
  deleteFaq,
} from "./sellerfaq.controller";
import {
  protect,
  checkSeller,
  validate,
} from "../../middlewares";
import { createFaqSchema, updateFaqSchema } from "./sellerfaq.validation";

const router = Router();

router.use(protect);
router.use(checkSeller);

router.get("/", listFaqs);
router.post("/", validate(createFaqSchema), createFaq);
router.get("/:id", getFaq);
router.patch("/:id", validate(updateFaqSchema), updateFaq);
router.delete("/:id", deleteFaq);

export default router;
