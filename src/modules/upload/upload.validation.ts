import { z } from "zod";
import { PRIVATE_FOLDER_PREFIX } from "./upload.constants";

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
