import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { AuthRequest } from "../types";

const checkBuyer = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const buyer = await prisma.buyerProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true, isActive: true },
    });

    if (!buyer) {
      throw new ApiError(403, "You are not registered as a buyer");
    }

    if (!buyer.isActive) {
      throw new ApiError(403, "Your buyer account is deactivated");
    }

    (req as any).buyerId = buyer.id;

    next();
  } catch (error) {
    next(error);
  }
};

export { checkBuyer };
