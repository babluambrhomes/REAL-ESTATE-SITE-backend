import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { AuthRequest } from "../types";
import { BuyerStatus } from "../generated/prisma/enums";

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
      select: { id: true, buyerStatus: true },
    });

    if (!buyer) {
      throw new ApiError(403, "You are not registered as a buyer");
    }

    // SUSPENDED and DELETED are both "cannot act as a buyer", but they
    // mean different things to support, so they get different messages.
    if (buyer.buyerStatus === BuyerStatus.DELETED) {
      throw new ApiError(403, "Your buyer account has been deleted");
    }
    if (buyer.buyerStatus === BuyerStatus.SUSPENDED) {
      throw new ApiError(403, "Your buyer account is suspended");
    }

    (req as any).buyerId = buyer.id;

    next();
  } catch (error) {
    next(error);
  }
};

export { checkBuyer };
