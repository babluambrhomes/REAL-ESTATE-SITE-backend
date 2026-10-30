import fs from "fs/promises";
import path from "path";
import { ApiError } from "../../utils";
import { processImage } from "../../workers/image/imageWorker.pool";
import {
  buildKey,
  deleteFromS3,
  getPublicUrl,
  uploadToS3,
} from "../../helpers/storage.helper";
import {
  IMAGE_FOLDER,
  IMAGE_MAX_WIDTH,
  IMAGE_QUALITY,
  PDF_FOLDER,
  PRIVATE_CACHE_CONTROL,
  PRIVATE_FOLDER_PREFIX,
  PUBLIC_CACHE_CONTROL,
  UploadVisibility,
} from "./upload.constants";

export interface UploadResult {
  key: string;
  url: string | null;
  visibility: UploadVisibility;
  mimeType: string;
  fileSize: number;
  originalName: string;
}

const isPdf = (file: Express.Multer.File): boolean =>
  file.mimetype === "application/pdf" ||
  path.extname(file.originalname).toLowerCase() === ".pdf";

/** Trust the file bytes, not just the mimetype/extension. */
const hasPdfHeader = async (filePath: string): Promise<boolean> => {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).includes("%PDF-");
  } finally {
    await handle.close().catch(() => undefined);
  }
};

const targetFolder = (
  folder: string,
  visibility: UploadVisibility
): string => {
  const clean = folder.replace(/^\/+|\/+$/g, "");
  return visibility === "PRIVATE"
    ? `${PRIVATE_FOLDER_PREFIX}/${clean}`
    : clean;
};

const removeFiles = async (files: Express.Multer.File[]): Promise<void> => {
  await Promise.all(
    files.map((file) => fs.unlink(file.path).catch(() => undefined))
  );
};

const rollback = async (keys: string[], files: Express.Multer.File[]) => {
  await removeFiles(files);
  await Promise.all(
    keys.map((key) => deleteFromS3(key).catch(() => undefined))
  );
};

const buildResult = (
  key: string,
  visibility: UploadVisibility,
  mimeType: string,
  file: Express.Multer.File
): UploadResult => {
  const url = visibility === "PUBLIC" ? getPublicUrl(key) : null;
  if (visibility === "PUBLIC" && !url) {
    throw new ApiError(500, "CLOUDFRONT_DOMAIN is not configured");
  }

  return {
    key,
    url,
    visibility,
    mimeType,
    fileSize: file.size,
    originalName: file.originalname,
  };
};

/** Image endpoint: resize to webp, upload public or private. */
const uploadImageFiles = async (
  files: Express.Multer.File[],
  folder = IMAGE_FOLDER,
  visibility: UploadVisibility = "PUBLIC"
): Promise<UploadResult[]> => {
  if (files.length === 0) throw new ApiError(400, "No files uploaded");

  const results: UploadResult[] = [];
  const uploadedKeys: string[] = [];
  const cacheControl =
    visibility === "PRIVATE" ? PRIVATE_CACHE_CONTROL : PUBLIC_CACHE_CONTROL;

  try {
    for (const file of files) {
      if (isPdf(file)) {
        throw new ApiError(400, "Only image files are allowed here");
      }

      const parsed = path.parse(file.path);
      const processed = await processImage({
        inputPath: file.path,
        outputDir: parsed.dir,
        originalName: path.parse(file.originalname).name,
        deleteOriginal: true,
        outputs: [
          {
            suffix: "upload",
            width: IMAGE_MAX_WIDTH,
            fit: "inside",
            format: "webp",
            quality: IMAGE_QUALITY,
          },
        ],
      });

      if (!processed.ok) {
        throw new ApiError(400, "Invalid or unsupported image file");
      }

      const outputPath = processed.outputs[0];
      const key = buildKey(
        targetFolder(folder, visibility),
        "image",
        path.extname(outputPath)
      );
      await uploadToS3(outputPath, key, "image/webp", cacheControl);
      uploadedKeys.push(key);
      await fs.unlink(outputPath).catch(() => undefined);

      results.push(buildResult(key, visibility, "image/webp", file));
    }
  } catch (error) {
    await rollback(uploadedKeys, files);
    throw error;
  }

  return results;
};

/** PDF endpoint: no resizing, upload public or private. */
const uploadPdfFiles = async (
  files: Express.Multer.File[],
  folder = PDF_FOLDER,
  visibility: UploadVisibility = "PRIVATE"
): Promise<UploadResult[]> => {
  if (files.length === 0) throw new ApiError(400, "No files uploaded");

  const results: UploadResult[] = [];
  const uploadedKeys: string[] = [];
  const cacheControl =
    visibility === "PRIVATE" ? PRIVATE_CACHE_CONTROL : PUBLIC_CACHE_CONTROL;

  try {
    for (const file of files) {
      if (!isPdf(file) || !(await hasPdfHeader(file.path))) {
        throw new ApiError(400, "Invalid PDF file");
      }

      const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
      const key = buildKey(
        targetFolder(folder, visibility),
        "document",
        ext
      );
      await uploadToS3(file.path, key, "application/pdf", cacheControl);
      uploadedKeys.push(key);
      await fs.unlink(file.path).catch(() => undefined);

      results.push(buildResult(key, visibility, "application/pdf", file));
    }
  } catch (error) {
    await rollback(uploadedKeys, files);
    throw error;
  }

  return results;
};

/** Reusable delete function — no endpoint. Call from any controller. */
const deleteUpload = async (key: string | string[]): Promise<void> => {
  const keys = Array.isArray(key) ? key : [key];
  const validKeys = keys.filter((k) => Boolean(k && k.trim()));
  await Promise.all(validKeys.map((k) => deleteFromS3(k)));
};

export { uploadImageFiles, uploadPdfFiles, deleteUpload };
