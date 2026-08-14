import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { AuthRequest, AuthUser } from "../types";
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

const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token =
      req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];

      console.log("Token from cookies:", req.cookies?.accessToken);
      console.log("Token from headers:", req.headers.authorization?.split(" ")[1]);

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

    if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
      throw new ApiError(403, "Account is not accessible");
    }

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

const authorize = (...roleNames: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const hasRole = req.user.memberships.some((m) =>
      roleNames.includes(m.role.roleName)
    );

    if (!hasRole) {
      throw new ApiError(403, "You are not authorized to access this route");
    }

    next();
  };
};

const authorizePlatformRole = (...platformRoleNames: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const isPlatformStaff = req.user.memberships.some(
      (m) =>
        m.scope === "PLATFORM" &&
        m.status === "ACTIVE" &&
        platformRoleNames.includes(m.role.roleName)
    );

    if (!isPlatformStaff) {
      throw new ApiError(403, "Platform access required");
    }

    next();
  };
};

export { protect, authorize, authorizePlatformRole, userSelect };
