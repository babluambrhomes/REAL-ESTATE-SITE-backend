import path from "path";

export const PROJECT_ROOT = process.cwd();
export const KYC_STORAGE_ROOT = path.join(PROJECT_ROOT, "private", "kyc");

export const resolvePrivatePath = (fileUrl: string): string =>
  path.isAbsolute(fileUrl) ? fileUrl : path.join(PROJECT_ROOT, fileUrl);
