import { Response } from "express";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { UpdateUserInput } from "./user.validation";
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
  const optimizedFilename = `${parsed.name}.webp`;
  const optimizedPath = path.join(parsed.dir, optimizedFilename);

  await sharp(file.path)
    .resize(400, 400, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(optimizedPath);

  await fs.unlink(file.path);

  const avatarUrl = `/uploads/${optimizedFilename}`;
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
