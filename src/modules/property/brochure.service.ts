import fs from "fs/promises";
import path from "path";
import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { resolvePrivatePath } from "../../config/storage";
import { isCloudinaryUrl } from "../../helpers/cloudinary.helper";

const getBrochure = async (propertyId: string, variantId: string) => {
  const variant = await prisma.propertyVariant.findFirst({
    where: {
      id: variantId,
      propertyId,
      property: { deletedAt: null, isActive: true },
    },
    select: { id: true, brochure: true },
  });

  if (!variant) {
    throw new ApiError(404, "Variant not found");
  }

  if (!variant.brochure) {
    throw new ApiError(404, "Brochure not available for this variant");
  }

  // --- CLOUDINARY (new) ---
  if (isCloudinaryUrl(variant.brochure)) {
    return { cloudinaryUrl: variant.brochure };
  }
  // --- LOCAL (old) -- keep for reference ---
  // const absPath = resolvePrivatePath(variant.brochure);

  const absPath = resolvePrivatePath(variant.brochure);

  try {
    await fs.access(absPath);
  } catch {
    throw new ApiError(404, "Brochure file not found on server");
  }

  return { absPath, filename: path.basename(absPath) };
};

export { getBrochure };
