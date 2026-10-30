import { S3Client } from "@aws-sdk/client-s3";

export const assertStorageEnv = (): void => {
  const required = ["AWS_REGION", "AWS_S3_BUCKET", "CLOUDFRONT_DOMAIN"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(", ")}`);
  }
};

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

export default s3;
