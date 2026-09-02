import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { AuthRequest } from "../types";
import { SellerType } from "../generated/prisma/enums";

const checkSeller = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true, isActive: true, verificationStatus: true },
    });

    if (!seller) {
      throw new ApiError(403, "You are not registered as a seller");
    }

    if (!seller.isActive) {
      throw new ApiError(403, "Your seller account is deactivated");
    }

    (req as any).sellerId = seller.id;

    next();
  } catch (error) {
    next(error);
  }
};

const checkSellerVerified = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: req.user.id },
      select: {
        id: true,
        isActive: true,
        verificationStatus: true,
        sellerType: true,
        organizationId: true,
      },
    });

    if (!seller) {
      throw new ApiError(403, "You are not registered as a seller");
    }

    if (!seller.isActive) {
      throw new ApiError(403, "Your seller account is deactivated");
    }

    if (seller.sellerType === SellerType.ORGANIZATION) {
      if (!seller.organizationId) {
        throw new ApiError(403, "Organization verification required for this action");
      }
      const org = await prisma.organization.findUnique({
        where: { id: seller.organizationId },
        select: { verificationStatus: true },
      });
      if (org?.verificationStatus !== "VERIFIED") {
        throw new ApiError(403, "Organization verification required for this action");
      }
    } else if (seller.verificationStatus !== "VERIFIED") {
      throw new ApiError(403, "Seller verification required for this action");
    }

    (req as any).sellerId = seller.id;

    next();
  } catch (error) {
    next(error);
  }
};

export { checkSeller, checkSellerVerified };
