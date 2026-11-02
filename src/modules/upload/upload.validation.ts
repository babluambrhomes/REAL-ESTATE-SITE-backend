import path from "path";
import { z } from "zod";
import {
  PRIVATE_FOLDER_PREFIX,
  VIDEO_ALLOWED_EXTENSIONS,
  VIDEO_ENTITY_TYPES,
  VIDEO_MAX_LENGTH_SECONDS,
  VIDEO_MAX_SIZE_BYTES,
} from "./upload.constants";

const folderSchema = z
  .string()
  .trim()
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, "Invalid folder")
  .refine(
    (value) =>
      value !== PRIVATE_FOLDER_PREFIX &&
      !value.startsWith(`${PRIVATE_FOLDER_PREFIX}/`),
    "Folder is reserved"
  );

export const uploadBodySchema = z.object({
  folder: folderSchema.optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
});

export type UploadBodyInput = z.infer<typeof uploadBodySchema>;

const videoNameSchema = z
  .string()
  .trim()
  .min(1, "Video name is required")
  .max(200, "Video name is too long")
  .refine(
    (name) =>
      VIDEO_ALLOWED_EXTENSIONS.includes(
        path.extname(name).toLowerCase() as (typeof VIDEO_ALLOWED_EXTENSIONS)[number]
      ),
    "Unsupported video format"
  );

export const videoPresignSchema = z.object({
  name: videoNameSchema,
  size: z.coerce
    .number()
    .int("Video size must be a whole number")
    .positive("Video size must be greater than 0")
    .max(VIDEO_MAX_SIZE_BYTES, "Video must be 20MB or less"),
  length: z.coerce
    .number()
    .positive("Video length must be greater than 0")
    .max(VIDEO_MAX_LENGTH_SECONDS, "Video must be 50 seconds or less"),
  entityType: z.enum(VIDEO_ENTITY_TYPES).default("GENERIC"),
});

export type VideoPresignInput = z.infer<typeof videoPresignSchema>;
