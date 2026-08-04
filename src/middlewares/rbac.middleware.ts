import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { AuthRequest } from "../types";

const checkPermission = (...permissionKeys: string[]) => {
  return async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated");
      }

      // Platform admins bypass permission check
      const isPlatformStaff = req.user.memberships.some(
        (m) => m.scope === "PLATFORM" && m.status === "ACTIVE"
      );

      if (isPlatformStaff) {
        next();
        return;
      }

      // Check organization memberships and their roles' permissions
      const memberships = await prisma.member.findMany({
        where: {
          userId: req.user.id,
          status: "ACTIVE",
        },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      });

      // Collect all permission codes from all memberships
      const userPermissions = new Set<string>();
      for (const membership of memberships) {
        for (const rp of membership.role.rolePermissions) {
          userPermissions.add(`${rp.permission.resource}:${rp.permission.action}`);
        }
      }

      // Check if user has at least one of the required permissions
      const hasPermission = permissionKeys.some((key) =>
        userPermissions.has(key)
      );

      if (!hasPermission) {
        throw new ApiError(
          403,
          `Required permissions: ${permissionKeys.join(" or ")}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

const checkRole = (...roleNames: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const hasRole = req.user.memberships.some((m) =>
      roleNames.includes(m.role.roleName)
    );

    if (!hasRole) {
      throw new ApiError(
        403,
        `Required role: ${roleNames.join(" or ")}`
      );
    }

    next();
  };
};

export { checkPermission, checkRole };
