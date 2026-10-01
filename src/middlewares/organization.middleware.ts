import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { AuthRequest } from "../types";
import { MemberScope, MemberStatus, OrganizationStatus } from "../generated/prisma/enums";
import { resolveRequestedOrgId } from "../helpers";

/**
 * Loads the caller's ACTIVE membership of the organization named in the
 * request, without requiring the org to have a public seller profile.
 *
 * That separation is deliberate. Managing an organization (inviting
 * members, editing roles) is a different question from selling through it,
 * and an org that somehow has no seller profile must still be fixable by
 * its owner rather than locked out. seller.middleware.ts owns the
 * selling-side context; this file owns the admin-side one.
 */
const loadOrgMembership = async (req: AuthRequest) => {
  if (!req.user) {
    throw new ApiError(401, "Not authenticated");
  }

  const organizationId = resolveRequestedOrgId(req);
  if (!organizationId) {
    throw new ApiError(
      400,
      "Organization ID required — pass it as :orgId, the x-organization-id header, or organizationId in the body"
    );
  }

  const membership = await prisma.member.findFirst({
    where: {
      userId: req.user.id,
      scope: MemberScope.ORGANIZATION,
      contextId: organizationId,
      status: MemberStatus.ACTIVE,
    },
    select: {
      id: true,
      roleId: true,
      contextId: true,
      role: { select: { roleName: true } },
      organization: { select: { id: true, status: true } },
    },
  });

  if (!membership) {
    throw new ApiError(403, "You are not an active member of this organization");
  }
  if (!membership.organization || !membership.contextId) {
    throw new ApiError(409, "Organization membership is inconsistent — please contact support");
  }
  if (membership.organization.status !== OrganizationStatus.ACTIVE) {
    throw new ApiError(403, "This organization is not active");
  }

  return {
    organizationId: membership.organization.id,
    membershipId: membership.id,
    roleId: membership.roleId,
    roleName: membership.role.roleName,
    organizationStatus: membership.organization.status,
  };
};

/**
 * Requires an explicit, active membership of the target organization.
 *
 * Unlike checkSeller there is no single-membership fallback: an org route
 * with no organization named is a caller bug, not something to guess at.
 */
const checkOrgMembership = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const org = await loadOrgMembership(req);
    req.orgContext = org;
    req.organizationId = org.organizationId;
    req.membershipId = org.membershipId;
    req.orgRoleId = org.roleId;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Requires the caller to be the organization's OWNER.
 *
 * Ownership is anchored to Organization.createdBy and is deliberately not
 * reassignable — see the ownership-transfer decision. The active
 * membership check is still required on top of that, so suspending the
 * owner immediately revokes their access rather than leaving a
 * createdBy check as a permanent back door.
 */
const checkOrgOwner = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const org = await loadOrgMembership(req);

    const organization = await prisma.organization.findUnique({
      where: { id: org.organizationId },
      select: { createdBy: true },
    });

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    if (organization.createdBy !== req.user!.id) {
      throw new ApiError(403, "Only the organization owner can perform this action");
    }

    req.orgContext = org;
    req.organizationId = org.organizationId;
    req.membershipId = org.membershipId;
    req.orgRoleId = org.roleId;

    next();
  } catch (error) {
    next(error);
  }
};

export { checkOrgMembership, checkOrgOwner, loadOrgMembership };
