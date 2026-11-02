import fs from "fs/promises";
import { Request, Response } from "express";
import { ApiError, ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { uploadImageFiles, uploadPdfFiles, createVideoPresign } from "./upload.service";

import { uploadBodySchema, videoPresignSchema } from "./upload.validation";

const cleanup = (files: Express.Multer.File[]) =>
  Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)));

export const uploadImage = asyncHandler(
  async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) ?? [];

    try {
      const parsed = uploadBodySchema.safeParse(req.body);
      if (!parsed.success) throw new ApiError(400, "Invalid upload options");

      const results = await uploadImageFiles(
        files,
        parsed.data.folder,
        parsed.data.visibility
      );
      res
        .status(201)
        .json(new ApiResponse(201, { files: results }, "Images uploaded"));
    } catch (error) {
      await cleanup(files);
      throw error;
    }
  }
);


export const uploadPdf = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) ?? [];

  try {
    const parsed = uploadBodySchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "Invalid upload options");

    const results = await uploadPdfFiles(
      files,
      parsed.data.folder,
      parsed.data.visibility
    );
    res
      .status(201)
      .json(new ApiResponse(201, { files: results }, "PDFs uploaded"));
  } catch (error) {
    await cleanup(files);
    throw error;
  }
});


export const presignVideo = asyncHandler(
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
