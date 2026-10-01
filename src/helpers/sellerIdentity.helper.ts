import slugify from "slugify";
import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { generateTimestampSuffix } from "./prisma.helper";

/**
 * Shared identity helpers for the two kinds of selling entity: an individual
 * seller and a company.
 *
 * These live here rather than in seller.service because both the individual
 * onboarding path and the organization creation path need them, and two
 * copies of a slug generator is how you end up with two different public URL
 * formats.
 */

/** Public reference code shown on a profile page, e.g. "SELL-2026...-4F2A". */
export const generateReferenceCode = (): string =>
  `SELL-${generateTimestampSuffix()}`;

/**
 * Builds a slug for a public profile URL.
 *
 * The random suffix is not decoration — `slug` is UNIQUE across all seller
 * profiles, so "sharma-realty" can only ever be claimed once, across every
 * organization on the platform. A collision surfaces as a P2002 and is
 * retried with a fresh slug by withUniqueRetry.
 */
export const generateSlug = (base: string): string => {
  const clean = slugify(base, { lower: true, strict: true }) || "seller";
  return `${clean}-${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
};

/**
 * Validates that a seller category exists and is active.
 *
 * Optional so that a profile can be created without one, but a seller with no
 * category cannot be discovered through category browse, so creation routes
 * make it required at the validation layer and this is the second check.
 */
export const ensureCategory = async (categoryId?: string): Promise<void> => {
  if (!categoryId) return;
  const category = await prisma.sellerCategory.findUnique({
    where: { id: categoryId },
    select: { isActive: true },
  });
  if (!category || !category.isActive) {
    throw new ApiError(400, "Invalid seller category");
  }
};
