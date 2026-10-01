import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { AuthRequest, AuthUser } from "../types";
import { UserStatus } from "../generated/prisma/enums";
import { verifyAccessToken } from "../helpers";

const userSelect = {
  id: true,
  email: true,
  phone: true,
  status: true,
  accountOrigin: true,
  emailVerified: true,
  phoneVerified: true,
  createdAt: true,
  updatedAt: true,
  person: {
    select: {
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
  memberships: {
    where: { status: "ACTIVE" },
    select: {
      id: true,
      scope: true,
      contextId: true,
      status: true,
      role: {
        select: {
          id: true,
          roleName: true,
          isSystemRole: true,
        },
      },
    },
  },
} as const;

/**
 * Which account states may hold a live session.
 *
 * PENDING is deliberately NOT blocked. /auth/private-otp-verify — the only
 * way an email/password signup becomes ACTIVE — sits behind `protect`, so
 * rejecting PENDING here would make email verification unreachable and lock
 * those users out permanently. Phone-only and Google signups are ACTIVE from
 * the start, so nothing unverified can act as a buyer, seller or org owner
 * anyway: those all gate on the ACTIVE row in their own profile.
 */
const assertSessionAllowed = (status: UserStatus): void => {
  if (status === UserStatus.SUSPENDED) {
    throw new ApiError(403, "Your account is suspended. Please contact support.");
  }
  if (status === UserStatus.DEACTIVATED) {
    throw new ApiError(403, "This account has been deactivated");
  }
};

const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {

    const token =
      req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];
    if (!token) {
      throw new ApiError(401, "Not authorized, please login");
    }

    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: userSelect,
    });

    if (!user) {
      throw new ApiError(401, "User not found");
    }

    // Checked against the database on every request rather than trusted from
    // the token, so a suspension takes effect immediately instead of after
    // the access token expires.
    assertSessionAllowed(user.status);

    req.user = user as AuthUser;
    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        message: "Access token expired",
        data: null,
        code: "TOKEN_EXPIRED",
      });
      return;
    }
    next(error);
  }
};

const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token =
      req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];

    if (!token) {
      next();
      return;
    }

    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: userSelect,
    });

    if (!user) {
      next();
      return;
    }

    try {
      assertSessionAllowed(user.status);
    } catch {
      // A suspended user is treated as anonymous on public routes, so their
      // own "my listings" page renders as logged-out rather than 403ing.
      next();
      return;
    }

    req.user = user as AuthUser;
    next();
  } catch {
    next();
  }
};

export { protect, optionalAuth, userSelect, assertSessionAllowed };
