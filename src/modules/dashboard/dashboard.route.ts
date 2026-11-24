import { Router } from "express";
import { protect, checkSeller } from "../../middlewares";
import { getSummary } from "./dashboard.controller";

const router = Router();

router.get("/summary", protect, checkSeller, getSummary);

export default router;
