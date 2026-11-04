import { Response } from "express";
import { ApiError, ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import type { VideoEntityType } from "../../generated/prisma/enums";
import {
  cancelVideo,
  createVideoPresign,
  deleteVideo,
  getVideo,
  getVideoStatus,
  listMyVideos,
  listVideosForEntity,
} from "./video.service";
import { videoPresignSchema } from "./video.validation";
import type {
  VideoEntityParamsInput,
  VideoListQueryInput,
  VideoPresignInput,
} from "./video.validation";

export const presignVideo = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const result = await createVideoPresign(
      req.body as VideoPresignInput,
      req.user!.id
    );

    res
      .status(201)
      .json(new ApiResponse(201, result, "Video upload URL created"));
  }
);

export const presignVideoLegacy = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const parsed = videoPresignSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid video upload options"
      );
    }

    const result = await createVideoPresign(parsed.data, req.user!.id);

    res
      .status(201)
      .json(new ApiResponse(201, result, "Video upload URL created"));
  }
);

export const getMyVideos = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const query = (req as unknown as { validatedQuery: VideoListQueryInput })
      .validatedQuery;

    const result = await listMyVideos(req.user!.id, query);
    res.status(200).json(new ApiResponse(200, result, "Videos fetched"));
  }
);

export const getVideoById = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const result = await getVideo(req.user!.id, String(req.params.id));
    res.status(200).json(new ApiResponse(200, result, "Video fetched"));
  }
);

export const getVideoStatusById = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const result = await getVideoStatus(req.user!.id, String(req.params.id));
    res.status(200).json(new ApiResponse(200, result, "Video status fetched"));
  }
);

export const getVideosForEntity = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { entityType, entityId } = req.params as VideoEntityParamsInput;
    const query = (req as unknown as { validatedQuery: VideoListQueryInput })
      .validatedQuery;

    const result = await listVideosForEntity(
      entityType as VideoEntityType,
      entityId,
      query
    );

    res
      .status(200)
      .json(new ApiResponse(200, result, "Entity videos fetched"));
  }
);

export const cancelVideoById = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const result = await cancelVideo(req.user!.id, String(req.params.id));
    res.status(200).json(new ApiResponse(200, result, "Video upload cancelled"));
  }
);

export const deleteVideoById = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const result = await deleteVideo(req.user!.id, String(req.params.id));
    res.status(200).json(new ApiResponse(200, result, "Video deleted"));
  }
);
