import { Response } from "express";
import path from "path";
import { ApiError, ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { UpdateUserInput } from "./user.validation";
import { processImage } from "../../workers/image/imageWorker.pool";
import * as userService from "./user.service";

const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await userService.getProfile(req.user!.id);
  res.status(200).json(new ApiResponse(200, user));
});

const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await userService.updateProfile(
    req.user!.id,
    req.body as UpdateUserInput
  );
  res.status(200).json(new ApiResponse(200, user, "Profile updated"));
});

const updateProfilePicture = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json(new ApiResponse(400, null, "No file uploaded"));
    return;
  }

  const parsed = path.parse(file.path);
  const result = await processImage({
    inputPath: file.path,
    outputDir: parsed.dir,
    originalName: path.parse(file.originalname).name,
    deleteOriginal: true,
    outputs: [
      { suffix: "avatar", width: 400, height: 400, fit: "cover", format: "webp", quality: 80 },
    ],
  });

  if (!result.ok) {
    throw new ApiError(500, result.error || "Image processing failed");
  }

  const relPath = path.relative(parsed.dir, result.outputs[0]).split(path.sep).join("/");
  const avatarUrl = `/uploads/${relPath}`;
  await userService.updateProfilePicture(req.user!.id, avatarUrl);

  res.status(200).json(new ApiResponse(200, { avatarUrl }, "Profile picture updated"));
});

const getAllUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await userService.getAllUsers(page, limit);
  res.status(200).json(new ApiResponse(200, result));
});

const getUserById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await userService.getUserById(String(req.params.id));
  res.status(200).json(new ApiResponse(200, user));
});

export { getProfile, updateProfile, updateProfilePicture, getAllUsers, getUserById };
