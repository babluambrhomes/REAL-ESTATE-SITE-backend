import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { AuthRequest } from "../types";
import { getRequiredDocs } from "../config/sellerKyc";
import { SellerType } from "../generated/prisma/enums";

const getSeller = async (req: AuthRequest) => {
  if (!req.user) {
    throw new ApiError(401, "Not authenticated");
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: req.user.id },
    select: {
      id: true,
      sellerType: true,
      organizationId: true,
      isActive: true,
      verificationStatus: true,
    },
  });

  if (!seller) {
    throw new ApiError(403, "You are not registered as a seller");
  }

  if (!seller.isActive) {
    throw new ApiError(403, "Your seller account is deactivated");
  }

  return seller;
};

// Document ka owner context decide karo:
//   INDIVIDUAL seller → sellerId (apne profile ke docs)
//   ORGANIZATION seller → organizationId (company docs central)
const getDocOwner = async (seller: {
  id: string;
  sellerType: SellerType;
  organizationId: string | null;
}): Promise<{ sellerId: string } | { organizationId: string }> => {
  if (seller.sellerType === SellerType.INDIVIDUAL) {
    return { sellerId: seller.id };
  }

  if (!seller.organizationId) {
    throw new ApiError(400, "Organization not linked to seller account");
  }

  return { organizationId: seller.organizationId };
};

const checkKycSubmitted = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const seller = await getSeller(req);

    const requiredDocs = getRequiredDocs(seller.sellerType);
    if (requiredDocs.length === 0) {
      (req as any).sellerId = seller.id;
      next();
      return;
    }

    const owner = await getDocOwner(seller);

    const submitted = await prisma.sellerVerificationDocument.findMany({
      where: owner,
      select: { docType: true },
    });

    const submittedTypes = new Set(submitted.map((d) => d.docType));
    const missing = requiredDocs.filter(
      (r) => !submittedTypes.has(r.docType)
    );

    if (missing.length > 0) {
      throw new ApiError(400, `KYC documents pending: ${missing.map((m) => m.displayLabel).join(", ")}`);
    }

    (req as any).sellerId = seller.id;
    next();
  } catch (error) {
    next(error);
  }
};

const checkKycVerified = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const seller = await getSeller(req);

    const isVerified = async () => {
      // ORGANIZATION seller → org level verification check
      if (seller.sellerType === SellerType.ORGANIZATION) {
        if (!seller.organizationId) {
          return false;
        }
        const org = await prisma.organization.findUnique({
          where: { id: seller.organizationId },
          select: { verificationStatus: true },
        });
        return org?.verificationStatus === "VERIFIED";
      }

      // INDIVIDUAL seller → profile level verification check
      return seller.verificationStatus === "VERIFIED";
    };

    if (await isVerified()) {
      (req as any).sellerId = seller.id;
      next();
      return;
    }

    const requiredDocs = getRequiredDocs(seller.sellerType);
    if (requiredDocs.length === 0) {
      throw new ApiError(403, "Seller KYC verification required for this action");
    }

    const owner = await getDocOwner(seller);

    const docs = await prisma.sellerVerificationDocument.findMany({
      where: owner,
      select: { docType: true, status: true },
    });

    const verifiedTypes = new Set(
      docs.filter((d) => d.status === "VERIFIED").map((d) => d.docType)
    );

    const missing = requiredDocs.filter((r) => !verifiedTypes.has(r.docType));

    if (missing.length > 0) {
      throw new ApiError(403, `Seller KYC verification required. Pending: ${missing.map((m) => m.displayLabel).join(", ")}`);
    }

    (req as any).sellerId = seller.id;
    next();
  } catch (error) {
    next(error);
  }
};

export { checkKycSubmitted, checkKycVerified };
