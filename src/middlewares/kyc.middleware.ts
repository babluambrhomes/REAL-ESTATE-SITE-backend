import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { AuthRequest } from "../types";
import { getRequiredDocs } from "../config/sellerKyc";
import { SellerType, VerificationStatus } from "../generated/prisma/enums";
import { resolveSellerContext } from "../helpers";

/**
 * Which column a KYC document hangs off.
 *
 *   INDIVIDUAL   → seller_id       (one person's documents)
 *   ORGANIZATION → organization_id (the company's documents, shared by all
 *                                    members — deliberately NOT per member,
 *                                    since staff turnover should not
 *                                    invalidate the company's KYC)
 *
 * A database CHECK constraint enforces that exactly one of the two is
 * ever set, so these two branches are the only legal shapes.
 */
const getDocOwner = (sellerId: string, sellerType: SellerType, organizationId: string | null) => {
  if (sellerType === SellerType.ORGANIZATION) {
    if (!organizationId) {
      throw new ApiError(409, "Organization seller profile is not linked to an organization");
    }
    return { organizationId };
  }
  return { sellerId };
};

/**
 * Requires the request to have submitted every KYC document its seller
 * type demands (submission, not approval).
 */
const checkKycSubmitted = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const ctx = await resolveSellerContext(req);
    req.sellerId = ctx.sellerId;
    req.sellerContext = ctx;

    const requiredDocs = getRequiredDocs(ctx.sellerType);
    if (requiredDocs.length === 0) {
      next();
      return;
    }

    const submitted = await prisma.sellerVerificationDocument.findMany({
      where: getDocOwner(ctx.sellerId, ctx.sellerType, ctx.organizationId),
      select: { docType: true },
    });

    const submittedTypes = new Set(submitted.map((d) => d.docType));
    const missing = requiredDocs.filter((r) => !submittedTypes.has(r.docType));

    if (missing.length > 0) {
      throw new ApiError(
        400,
        `KYC documents pending: ${missing.map((m) => m.displayLabel).join(", ")}`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Requires the acting selling entity to be verified.
 *
 * For organizations that means Organization.verificationStatus, because a
 * company listing is a claim about the company rather than about whoever
 * happens to be logged in.
 */
const checkKycVerified = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const ctx = await resolveSellerContext(req);
    req.sellerId = ctx.sellerId;
    req.sellerContext = ctx;

    const verificationStatus =
      ctx.organizationVerificationStatus ?? ctx.verificationStatus;

    if (verificationStatus === VerificationStatus.VERIFIED) {
      next();
      return;
    }

    const requiredDocs = getRequiredDocs(ctx.sellerType);
    if (requiredDocs.length === 0) {
      throw new ApiError(403, "Seller KYC verification required for this action");
    }

    const docs = await prisma.sellerVerificationDocument.findMany({
      where: getDocOwner(ctx.sellerId, ctx.sellerType, ctx.organizationId),
      select: { docType: true, status: true },
    });

    const verifiedTypes = new Set(
      docs.filter((d) => d.status === VerificationStatus.VERIFIED).map((d) => d.docType)
    );

    const missing = requiredDocs.filter((r) => !verifiedTypes.has(r.docType));

    if (missing.length > 0) {
      throw new ApiError(
        403,
        `Seller KYC verification required. Pending: ${missing.map((m) => m.displayLabel).join(", ")}`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export { checkKycSubmitted, checkKycVerified };
