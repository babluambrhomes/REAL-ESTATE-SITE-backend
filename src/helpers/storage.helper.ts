import crypto from "crypto";
import fs from "fs/promises";
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

export {
  buildKey,
  uploadToS3,
  deleteFromS3,
  getPublicUrl,
  getPresignedUrl,
};
