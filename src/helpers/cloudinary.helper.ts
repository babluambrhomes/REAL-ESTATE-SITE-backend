import cloudinary from "../config/cloudinary";

const isCloudinaryUrl = (url: string): boolean => url.includes("res.cloudinary.com");

// Url se public_id nikalein (jo/token/batch segments skip karke).
// Example:
//   https://res.cloudinary.com/cloud/image/upload/v123/real-esate/users/avatars/abc.webp
//   -> real-esate/users/avatars/abc
const extractPublicId = (url: string): string => {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/");
    // "upload" ke baad ka segment Public ID hota hai
    const uploadIndex = segments.indexOf("upload");
    if (uploadIndex === -1) return "";
    const rest = segments.slice(uploadIndex + 1);
    // Version segment (v123...) skip karo agar hoga
    if (rest[0] && /^v\d+$/.test(rest[0])) rest.shift();
    const last = rest[rest.length - 1] || "";
    // Extension remove karo
    const withoutExt = last.replace(/\.[a-zA-Z0-9]+$/, "");
    rest[rest.length - 1] = withoutExt;
    return rest.join("/");
  } catch {
    return "";
  }
};

interface UploadOptions {
  folder?: string;
  resourceType?: "image" | "video" | "raw" | "auto";
}

// Disk pe file pehle se saved hai (filePath) — ise Cloudinary pe upload karo.
// Resized/processed file upload hota hai. Local file yahan delete nahi hota —
// caller handle karta hai (ya deleteOriginal flag pehle hi karta hai).
const uploadFile = async (
  filePath: string,
  options: UploadOptions = {}
): Promise<{ url: string; publicId: string }> => {
  const { folder, resourceType = "image" } = options;

  const result = await cloudinary.uploader.upload(filePath, {
    folder: folder || process.env.CLOUDINARY_FOLDER || "real-estate",
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  });

  return { url: result.secure_url, publicId: result.public_id };
};

// Cloudinary asset delete. fileUrlOrPublicId public_id ya full URL ho sakta hai.
const deleteCloudinaryFile = async (
  fileUrlOrPublicId: string,
  resourceType: "image" | "video" | "raw" | "auto" = "image"
): Promise<void> => {
  if (!fileUrlOrPublicId) return;

  let publicId = fileUrlOrPublicId;
  if (isCloudinaryUrl(fileUrlOrPublicId) || fileUrlOrPublicId.startsWith("http")) {
    publicId = extractPublicId(fileUrlOrPublicId);
  }

  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch {
    // Ignore delete errors
  }
};

export { uploadFile, deleteCloudinaryFile, extractPublicId, isCloudinaryUrl };
