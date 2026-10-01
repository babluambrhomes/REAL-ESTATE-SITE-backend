import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { SellerContext, AuthRequest } from "../types";
import {
  SellerStatus,
  MemberScope,
  MemberStatus,
  OrganizationStatus,
  VerificationStatus,
} from "../generated/prisma/enums";

/**
 * Which organization is the request acting through?
 *
 * Resolution order (first hit wins):
 *   1. :orgId route param        — e.g. /orgs/:orgId/properties
 *   2. x-organization-id header   — for endpoints without an org in the path
 *   3. body.organizationId       — on create
 *   4. query.organizationId      — on list
 *
 * If the caller gave no hint AND belongs to exactly one org, that org is
 * used. If they belong to several, the request is rejected rather than
 * guessed — silently picking one would let an agent with access to two
 * companies write into the wrong one without ever noticing.
 */
export const resolveRequestedOrgId = (req: AuthRequest): string | undefined => {
  const candidates = [
    (req.params as Record<string, string | undefined>)?.orgId,
    req.get?.("x-organization-id") ?? undefined,
    (req.body as Record<string, unknown> | undefined)?.organizationId as string | undefined,
    (req.query as Record<string, unknown> | undefined)?.organizationId as string | undefined,
  ];
  return candidates.find((v) => typeof v === "string" && v.length > 0);
};

/**
 * Loads the org membership the request is acting through, plus the org's
 * shared public seller profile.
 *
 * The org's SellerProfile is what leads / site visits / questions are
 * addressed to — individual members deliberately do NOT get their own
 * seller profile, so the org has exactly one public presence.
 */
export const resolveOrgContext = async (
  userId: string,
  organizationId: string | undefined
): Promise<SellerContext> => {
  const memberships = await prisma.member.findMany({
    where: {
      userId,
      scope: MemberScope.ORGANIZATION,
      status: MemberStatus.ACTIVE,
      ...(organizationId ? { contextId: organizationId } : {}),
    },
    include: {
      organization: {
        select: {
          id: true,
          status: true,
          verificationStatus: true,
          sellerProfile: { select: { id: true, sellerStatus: true, sellerType: true } },
        },
      },
      role: { select: { id: true, roleName: true } },
    },
  });

  if (memberships.length === 0) {
    if (organizationId) {
      throw new ApiError(403, "You are not an active member of this organization");
    }
    throw new ApiError(403, "You are not a member of any organization");
  }

  if (memberships.length > 1) {
    throw new ApiError(
      400,
      "You belong to multiple organizations. Specify which one via the :orgId param, the x-organization-id header, or organizationId in the body."
    );
  }

  const membership = memberships[0];
  const organization = membership.organization;

  if (!organization || organization.status !== OrganizationStatus.ACTIVE) {
    throw new ApiError(403, "This organization is not active");
  }

  const sellerProfile = organization.sellerProfile;
  if (!sellerProfile) {
    throw new ApiError(
      409,
      "This organization has no public seller profile yet, so it cannot receive listings or enquiries"
    );
  }
  if (sellerProfile.sellerStatus === SellerStatus.DELETED) {
    throw new ApiError(403, "This organization's seller profile has been deleted");
  }
  if (sellerProfile.sellerStatus === SellerStatus.SUSPENDED) {
    throw new ApiError(403, "This organization's seller profile is suspended");
  }

  return {
    sellerId: sellerProfile.id,
    sellerType: sellerProfile.sellerType,
    userId,
    organizationId: organization.id,
    membershipId: membership.id,
    roleId: membership.role.id,
    roleName: membership.role.roleName,
    // A company listing is a claim about the company, so verification is
    // read from Organization — not from the shared seller profile.
    verificationStatus: organization.verificationStatus,
    organizationVerificationStatus: organization.verificationStatus,
  };
};

/** Loads the acting user's own INDIVIDUAL seller profile. */
export const resolveIndividualContext = async (userId: string): Promise<SellerContext> => {
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      sellerType: true,
      sellerStatus: true,
      verificationStatus: true,
      organizationId: true,
    },
  });

  if (!seller) {
    throw new ApiError(403, "You are not registered as an individual seller");
  }

  if (seller.sellerStatus === SellerStatus.DELETED) {
    throw new ApiError(403, "Your seller profile has been deleted");
  }
  if (seller.sellerStatus === SellerStatus.SUSPENDED) {
    throw new ApiError(403, "Your seller account is suspended");
  }

  // Defence in depth. The DB has a CHECK constraint that makes this
  // impossible (an INDIVIDUAL profile must have organization_id NULL),
  // but a silent mismatch here would mean writing listings against the
  // wrong seller, so it is worth an explicit check.
  if (seller.sellerType !== "INDIVIDUAL" || seller.organizationId !== null) {
    throw new ApiError(409, "Your seller profile is inconsistent — please contact support");
  }

  return {
    sellerId: seller.id,
    sellerType: seller.sellerType,
    userId,
    organizationId: null,
    membershipId: null,
    roleId: null,
    roleName: null,
    verificationStatus: seller.verificationStatus,
    organizationVerificationStatus: null,
  };
};

/**
 * Resolves the selling context for a request.
 *
 * Order of preference:
 *   1. An explicitly requested org (param / header / body / query)
 *   2. The user's own individual seller profile
 *   3. Their single org membership
 *
 * Step 2 before step 3 is deliberate. When someone has both, "create a
 * property" without naming an org means their own listing — the more
 * specific, less destructive interpretation. Naming the org opts into
 * step 1 explicitly, so there is never a silent switch into company data.
 */
export const resolveSellerContext = async (req: AuthRequest): Promise<SellerContext> => {
  const userId = req.user!.id;
  const requestedOrgId = resolveRequestedOrgId(req);

  if (requestedOrgId) {
    return resolveOrgContext(userId, requestedOrgId);
  }

  const hasIndividualProfile = await prisma.sellerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (hasIndividualProfile) {
    return resolveIndividualContext(userId);
  }

  return resolveOrgContext(userId, undefined);
};

/** Same, but starting from a userId instead of a request. */
export const resolveSellerContextForUser = async (
  userId: string,
  requestedOrgId?: string
): Promise<SellerContext> => {
  if (requestedOrgId) {
    return resolveOrgContext(userId, requestedOrgId);
  }

  const hasIndividualProfile = await prisma.sellerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (hasIndividualProfile) {
    return resolveIndividualContext(userId);
  }

  return resolveOrgContext(userId, undefined);
};

/** Rejects unless the acting context is fully verified. */
export const assertSellerVerified = (ctx: SellerContext): void => {
  const required = ctx.organizationVerificationStatus ?? ctx.verificationStatus;
  if (required !== VerificationStatus.VERIFIED) {
    throw new ApiError(
      403,
      ctx.organizationId
        ? "Organization verification is required for this action"
        : "Seller verification is required for this action"
    );
  }
};
