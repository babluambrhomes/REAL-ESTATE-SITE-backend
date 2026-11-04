import { Router } from "express";
import { parseQuery, protect, uploadRateLimit, validate } from "../../middlewares";
import {
  cancelVideoById,
  deleteVideoById,
  getMyVideos,
  getVideoById,
  getVideoStatusById,
  getVideosForEntity,
  presignVideo,
} from "./video.controller";
import {
  videoEntityParamsSchema,
  videoListQuerySchema,
  videoPresignSchema,
} from "./video.validation";

const router = Router();

router.post(
  "/presign",
  protect,
  uploadRateLimit,
  validate(videoPresignSchema),
  presignVideo
);

router.get("/my", protect, parseQuery(videoListQuerySchema), getMyVideos);

router.get(
  "/entity/:entityType/:entityId",
  validate(videoEntityParamsSchema, "params"),
  parseQuery(videoListQuerySchema),
  getVideosForEntity
);

router.get("/:id/status", protect, getVideoStatusById);
router.post("/:id/cancel", protect, cancelVideoById);
router.delete("/:id", protect, deleteVideoById);
router.get("/:id", protect, getVideoById);

export default router;
