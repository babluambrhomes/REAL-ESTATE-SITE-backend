import { Router } from "express";
import { protect, uploadAny, uploadRateLimit } from "../../middlewares";
import { uploadImage, uploadPdf } from "./upload.controller";

const router = Router();

router.post("/image", protect, uploadRateLimit, uploadAny.any(), uploadImage);
router.post("/pdf", protect, uploadRateLimit, uploadAny.any(), uploadPdf);

export default router;
