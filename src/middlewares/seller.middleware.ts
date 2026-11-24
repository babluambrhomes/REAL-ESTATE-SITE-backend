import { Response, NextFunction } from "express";
import { ApiError } from "../utils";
import { AuthRequest, SellerContext } from "../types";
import { SellerType } from "../generated/prisma/enums";
import { INDIVIDUAL_PERMISSION_KEYS } from "../seed/permissions.catalog";
import {
  resolveSellerContext,
  resolveOrgContext,
  resolveIndividualContext,
  resolveRequestedOrgId,
  assertSellerVerified,
} from "../helpers";
import {
  assertOrgPermission,
  assertIndividualPermission,
} from "./rbac.middleware";

const requireAuth = (req: AuthRequest): string => {
  if (!req.user) {
    throw new ApiError(401, "Not authenticated");
  }
  return req.user.id;
};

/**
 * Requires a selling context (individual seller OR org member).
 *
 * Sets req.sellerId (the public selling entity's profile id) and
 * req.sellerContext (the full resolved context).
 */
const checkSeller = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = requireAuth(req);

    const ctx = await resolveSellerContext(req);
    req.sellerId = ctx.sellerId;
    req.sellerContext = ctx;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Same as checkSeller, but additionally requires the acting entity to be
 * verified. Org members are gated on Organization.verificationStatus.
 */
const checkSellerVerified = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = requireAuth(req);

    const ctx = await resolveSellerContext(req);
    assertSellerVerified(ctx);

    req.sellerId = ctx.sellerId;
    req.sellerContext = ctx;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Requires the acting user to have their OWN individual seller profile.
 *
 * Used for endpoints that only ever make sense for a person acting as
 * themselves — editing your own public profile, your slug, your logo.
 * An org member without an individual profile must not be able to edit
 * the org's profile through these routes.
 */
const checkIndividualSeller = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = requireAuth(req);

    const ctx = await resolveIndividualContext(userId);
    req.sellerId = ctx.sellerId;
    req.sellerContext = ctx;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Requires the request to act through an organization, with the
 * organization named explicitly (see resolveRequestedOrgId).
 *
 * Unlike checkSeller there is no "single membership" fallback: an org
 * endpoint with no org specified is a caller bug, not something to
 * guess at.
 */
const checkOrgMember = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = requireAuth(req);

    const requestedOrgId = resolveRequestedOrgId(req);
    if (!requestedOrgId) {
      throw new ApiError(
        400,
        "Organization ID required — pass it as :orgId, the x-organization-id header, or organizationId in the body"
      );
    }

    const ctx = await resolveOrgContext(userId, requestedOrgId);
    req.sellerId = ctx.sellerId;
    req.sellerContext = ctx;

    next();
  } catch (error) {
    next(error);
  }
};

const checkSellerPermission =
  (...permissionKeys: string[]) =>
  async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = requireAuth(req);
      const ctx = req.sellerContext;

      if (!ctx) {
        throw new ApiError(
          500,
          "Seller context not resolved — run checkSeller before checkSellerPermission"
        );
      }

      if (ctx.organizationId) {
        await assertOrgPermission(userId, ctx.organizationId, permissionKeys);
      } else if (ctx.sellerType === SellerType.INDIVIDUAL) {
        const individualKeys = permissionKeys.filter((key) =>
          INDIVIDUAL_PERMISSION_KEYS.has(key)
        );

        if (individualKeys.length === 0) {
          throw new ApiError(
            403,
            `Required permission: ${permissionKeys.join(" or ")}`
          );
        }

        await assertIndividualPermission(userId, individualKeys);
      } else {
        throw new ApiError(
          403,
          "You do not have a selling context that can use this permission"
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export {
  checkSeller,
  checkSellerVerified,
  checkIndividualSeller,
  checkOrgMember,
  checkSellerPermission,
  resolveSellerContext,
  resolveOrgContext,
  resolveRequestedOrgId,
};
export type { SellerContext };
