import fs from "fs/promises";
import { Request, Response } from "express";
import { ApiError, ApiResponse, asyncHandler } from "../../utils";
import { uploadImageFiles, uploadPdfFiles } from "./upload.service";
import { uploadBodySchema } from "./upload.validation";

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
