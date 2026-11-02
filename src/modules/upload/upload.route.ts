import { Router } from "express";
import { protect, uploadAny, uploadRateLimit } from "../../middlewares";
import { presignVideo, uploadImage, uploadPdf } from "./upload.controller";

const router = Router();

router.post("/image", protect, uploadRateLimit, uploadAny.any(), uploadImage);
router.post("/pdf", protect, uploadRateLimit, uploadAny.any(), uploadPdf);
router.post("/video/presign", protect, uploadRateLimit, presignVideo);

export default router;
