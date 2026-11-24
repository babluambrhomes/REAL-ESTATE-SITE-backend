import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../config/s3";
import { ApiError } from "../utils";

const getBucket = (): string => {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new ApiError(500, "AWS_S3_BUCKET is not configured");
  return bucket;
};

/** product + image + .webp -> product/image-<uuid>.webp */
const buildKey = (folder: string, baseName: string, ext: string): string => {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
  const cleanExt = ext.replace(/^\./, "").toLowerCase();
  return `${cleanFolder}/${baseName}-${crypto.randomUUID()}.${cleanExt}`;
};

const uploadToS3 = async (
  localPath: string,
  key: string,
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable"
): Promise<void> => {
  const body = await fs.readFile(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
};

/** Reusable delete function — call it from any controller/service. */
const deleteFromS3 = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
};

/** Public URL via CloudFront. Private objects never get a public URL. */
const getPublicUrl = (key: string): string => {
  const domain = process.env.CLOUDFRONT_DOMAIN;
  if (!domain) return "";
  return `${domain.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
};

/**
 * Temporary S3 URL for private objects. Call it only after auth/ownership
 * checks in the controller. expiresIn is in seconds (max 604800).
 */
const getPresignedUrl = async (
  key: string,
  expiresIn = 900
): Promise<string> =>
  getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn }
  );

type StoredVisibility = "PUBLIC" | "PRIVATE";

const PRIVATE_FOLDER = "private";
const PUBLIC_CACHE = "public, max-age=31536000, immutable";
const PRIVATE_CACHE = "private, no-store";

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const isS3Key = (value: string): boolean =>
  !isHttpUrl(value) &&
  !value.startsWith("/") &&
  !value.includes("..") &&
  !path.isAbsolute(value) &&
  /^[A-Za-z0-9][A-Za-z0-9/_-]*\.[A-Za-z0-9]+$/i.test(value);

const normalizeFolder = (folder: string): string =>
  folder.trim().replace(/^\/+|\/+$/g, "");

const visibilityFolder = (
  folder: string,
  visibility: StoredVisibility
): string => {
  const clean = normalizeFolder(folder);
  return visibility === "PRIVATE" ? `${PRIVATE_FOLDER}/${clean}` : clean;
};

const visibilityCache = (visibility: StoredVisibility): string =>
  visibility === "PRIVATE" ? PRIVATE_CACHE : PUBLIC_CACHE;

const uploadLocalFile = async (
  localPath: string,
  folder: string,
  contentType: string,
  visibility: StoredVisibility = "PUBLIC"
): Promise<{ key: string; url: string | null }> => {
  if (visibility === "PUBLIC" && !process.env.CLOUDFRONT_DOMAIN) {
    throw new ApiError(500, "CLOUDFRONT_DOMAIN is not configured");
  }

  const parsed = path.parse(localPath);
  const key = buildKey(
    visibilityFolder(folder, visibility),
    parsed.name || "file",
    parsed.ext || ".bin"
  );

  try {
    await uploadToS3(localPath, key, contentType, visibilityCache(visibility));
  } finally {
    await fs.unlink(localPath).catch(() => undefined);
  }

  return {
    key,
    url: visibility === "PUBLIC" ? getPublicUrl(key) : null,
  };
};

const keyFromPublicUrl = (value: string): string | null => {
  const domain = process.env.CLOUDFRONT_DOMAIN;
  if (!domain || !isHttpUrl(value)) return null;

  try {
    const base = new URL(domain.includes("://") ? domain : `https://${domain}`);
    const candidate = new URL(value);
    if (candidate.host.toLowerCase() !== base.host.toLowerCase()) return null;

    const decoded = decodeURIComponent(candidate.pathname.replace(/^\/+/, ""));
    return isS3Key(decoded) ? decoded : null;
  } catch {
    return null;
  }
};

const storedKey = (value: string): string | null =>
  isS3Key(value) ? value : keyFromPublicUrl(value);

const deleteStoredFile = async (
  value: string | null | undefined
): Promise<void> => {
  if (!value) return;
  const key = storedKey(value);
  if (!key) return;
  await deleteFromS3(key).catch(() => undefined);
};

const resolvePublicStoredUrl = (value: string): string | null => {
  const key = storedKey(value);
  return key ? getPublicUrl(key) : null;
};

const resolvePrivateStoredUrl = async (
  value: string
): Promise<string | null> => {
  if (!isS3Key(value)) return null;
  return getPresignedUrl(value);
};

export {
  buildKey,
  uploadToS3,
  deleteFromS3,
  getPublicUrl,
  getPresignedUrl,
  uploadLocalFile,
  deleteStoredFile,
  resolvePublicStoredUrl,
  resolvePrivateStoredUrl,
  isS3Key,
  isHttpUrl,
};
