import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { AuthRequest } from "../types";

const checkOrgMembership = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const membership = await prisma.member.findFirst({
      where: {
        userId: req.user.id,
        scope: "ORGANIZATION",
        status: "ACTIVE",
      },
      include: {
        organization: { select: { id: true, status: true } },
      },
    });

    if (!membership) {
      throw new ApiError(403, "You are not a member of any organization");
    }

    if (!membership.organization || membership.organization.status !== "ACTIVE") {
      throw new ApiError(403, "Your organization is not active");
    }

    (req as any).organizationId = membership.contextId;
    (req as any).membershipId = membership.id;
    (req as any).orgRoleId = membership.roleId;

    next();
  } catch (error) {
    next(error);
  }
};

const checkOrgOwner = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const orgId = req.params.orgId || (req as any).organizationId;

    if (!orgId) {
      throw new ApiError(400, "Organization ID required");
    }

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { createdBy: true, status: true },
    });

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    if (organization.createdBy !== req.user.id) {
      throw new ApiError(403, "You are not the owner of this organization");
    }

    if (organization.status !== "ACTIVE") {
      throw new ApiError(403, "Organization is not active");
    }

    next();
  } catch (error) {
    next(error);
  }
};

export { checkOrgMembership, checkOrgOwner };
