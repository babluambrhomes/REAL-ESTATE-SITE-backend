export const IMAGE_FOLDER = "images";
export const PDF_FOLDER = "documents";
export const PRIVATE_FOLDER_PREFIX = "private";

// --- Video (Mux direct upload) ---
export const VIDEO_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const VIDEO_MAX_LENGTH_SECONDS = 50;
export const VIDEO_UPLOAD_TIMEOUT_SECONDS = 60 * 60; // signed URL valid for 1 hour
export const VIDEO_ALLOWED_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".mkv"] as const;

export const VIDEO_ENTITY_TYPES = ["PROPERTY", "SELLER", "ORGANIZATION"] as const;

export const VIDEO_STATUSES = [
  "WAITING",
  "UPLOADING",
  "ASSET_CREATED",
  "PROCESSING",
  "READY",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
] as const;

export type VideoEntityType = (typeof VIDEO_ENTITY_TYPES)[number];

export const IMAGE_MAX_WIDTH = 1600;
export const IMAGE_QUALITY = 85;

export type UploadVisibility = "PUBLIC" | "PRIVATE";

export const PUBLIC_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const PRIVATE_CACHE_CONTROL = "private, no-store";
