import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { AuthRequest } from "../types";
import { MemberScope, MemberStatus, PermissionScope } from "../generated/prisma/enums";
import {
  PLATFORM_PERMISSION_KEYS,
  ORGANIZATION_PERMISSION_KEYS,
} from "../seed/permissions.catalog";

/**
 * Scoped authorization.
 *
 * The whole point of this file is that a permission is only ever evaluated
 * INSIDE the scope it belongs to. Two bugs made the previous version unsafe:
 *
 *   1. Platform bypass. ANY active PLATFORM membership skipped permission
 *      checks entirely — including on organization routes. A platform
 *      Support Agent could therefore remove members from any company in the
 *      system, not just work platform tickets.
 *
 *   2. Cross-org leak. Permissions were aggregated from EVERY active
 *      membership the user had. An agent who was OWNER of Sharma Realty and
 *      STAFF at another brokerage carried the first company's permissions
 *      into the second company's routes.
 *
 * The fix is to make scope a required argument rather than something
 * inferred from the user's memberships. The route declares which scope it is
 * guarding, and the membership query is narrowed to exactly that scope —
 * PLATFORM, or ORGANIZATION within the org this request names.
 *
 * Note there is deliberately no wildcard/superuser bypass. A Super Admin
 * satisfies platform guards the honest way: its role holds every PLATFORM
 * permission from the catalogue. That way "bypass everything" stays a
 * data change, visible in role_permissions, rather than a hardcoded `if`
 * nobody can audit.
 */

const SCOPE_KEY_SETS: Record<PermissionScope, Set<string>> = {
  [PermissionScope.PLATFORM]: PLATFORM_PERMISSION_KEYS,
  [PermissionScope.ORGANIZATION]: ORGANIZATION_PERMISSION_KEYS,
};

/**
 * A permission key such as "property:update" is ambiguous on its own —
 * "property:read" exists in both scopes. Requiring the scope at every call
 * site removes the ambiguity instead of leaving it to a comment.
 */
const permissionCode = (resource: string, action: string): string =>
  `${resource}:${action}`;

/**
 * Which org is this request acting through?
 *
 * Mirrors resolveRequestedOrgId from the seller helpers, but inlined to keep
 * this module free of seller-profile concerns: RBAC must work for callers who
 * have no selling context at all (platform staff, org admins who have not
 * created a seller profile).
 */
const resolveOrganizationIdForRequest = (req: AuthRequest): string | null => {
  const candidates = [
    (req.params as Record<string, string | undefined>)?.orgId,
    req.get?.("x-organization-id") ?? undefined,
    (req.body as Record<string, unknown> | undefined)?.organizationId,
    (req.query as Record<string, unknown> | undefined)?.organizationId,
  ];

  const found = candidates.find(
    (v): v is string => typeof v === "string" && v.length > 0
  );

  if (!found) {
    throw new ApiError(
      400,
      "Organization ID required — pass it as :orgId, the x-organization-id header, or organizationId in the body or query"
    );
  }

  return found;
};

interface ScopedMembership {
  id: string;
  contextId: string | null;
  role: {
    id: string;
    roleName: string;
    rolePermissions: {
      permission: {
        scope: PermissionScope;
        resource: string;
        action: string;
      };
    }[];
  };
}

/**
 * Loads the caller's ACTIVE memberships, narrowed to one scope and — for
 * organization scope — to the single org the request is acting through.
 *
 * The org narrowing is the security boundary. It is applied in the query,
 * not filtered afterwards, so a permission from another org is never even
 * loaded into memory.
 */
const loadScopedMemberships = async (
  userId: string,
  scope: PermissionScope,
  organizationId: string | null
): Promise<ScopedMembership[]> =>
  prisma.member.findMany({
    where: {
      userId,
      status: MemberStatus.ACTIVE,
      ...(scope === PermissionScope.ORGANIZATION
        ? { scope: MemberScope.ORGANIZATION, contextId: organizationId }
        : { scope: MemberScope.PLATFORM, contextId: null }),
    },
    select: {
      id: true,
      contextId: true,
      role: {
        select: {
          id: true,
          roleName: true,
          rolePermissions: {
            select: {
              permission: {
                select: { scope: true, resource: true, action: true },
              },
            },
          },
        },
      },
    },
  });

/**
 * Guards a route behind one or more permissions in a declared scope.
 *
 *   checkPermission(PermissionScope.PLATFORM, "organization:verify")
 *   checkPermission(PermissionScope.ORGANIZATION, "property:update", "property:delete")
 *
 * Keys are OR-ed: holding any one of them passes.
 *
 * For ORGANIZATION scope the target org must be named explicitly (param,
 * header, body or query — see resolveRequestedOrgId). We do not fall back to
 * "their only org": on an authorization decision, guessing which tenant the
 * caller meant is exactly the mistake that leads to writing into the wrong
 * company.
 */
const checkPermission =
  (scope: PermissionScope, ...permissionKeys: string[]) =>
  async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated");
      }

      // Reject unknown keys loudly. Silently ignoring a key that does not
      // exist in the catalogue would turn a typo like "proprty:update" into
      // a permanently locked route instead of an obvious bug.
      const known = SCOPE_KEY_SETS[scope];
      for (const key of permissionKeys) {
        if (!known.has(key)) {
          throw new ApiError(
            500,
            `Unknown ${scope} permission "${key}" — add it to the permission catalogue or fix the route guard`
          );
        }
      }

      const organizationId =
        scope === PermissionScope.ORGANIZATION
          ? resolveOrganizationIdForRequest(req)
          : null;

      const memberships = await loadScopedMemberships(
        req.user.id,
        scope,
        organizationId
      );

      if (memberships.length === 0) {
        throw new ApiError(
          403,
          scope === PermissionScope.ORGANIZATION
            ? `You are not an active member of organization ${organizationId}`
            : "You do not have an active platform membership"
        );
      }

      // Union across the user's memberships in this scope only. A user can
      // hold several roles in one org and the grants add up.
      const granted = new Set<string>();
      for (const membership of memberships) {
        for (const rp of membership.role.rolePermissions) {
          // Scope is re-checked on the permission itself: role_permissions
          // has no scope column, so a mis-seeded role could otherwise grant a
          // PLATFORM permission through an ORGANIZATION role.
          if (rp.permission.scope !== scope) continue;
          granted.add(permissionCode(rp.permission.resource, rp.permission.action));
        }
      }

      const hasPermission = permissionKeys.some((key) => granted.has(key));

      if (!hasPermission) {
        throw new ApiError(
          403,
          `Required permission: ${permissionKeys.join(" or ")}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };

/**
 * Convenience alias with a readable call site.
 *
 *   requirePermission("ORGANIZATION", "property:update")
 *
 * Not needed for correctness — checkPermission takes the same arguments —
 * but it is what the route files read best against.
 */
const requirePermission = (scope: PermissionScope, ...keys: string[]) =>
  checkPermission(scope, ...keys);

/**
 * Guards a route by role NAME, in a declared scope.
 *
 * Narrower than checkPermission and mostly useful for the handful of routes
 * where the role itself is the thing being asserted ("only the company owner
 * can transfer ownership"). Prefer permissions elsewhere — role names can be
 * renamed, and a permission check fails closed when a role is.
 *
 * Also scope- and status-aware, unlike the previous version which matched on
 * roleName alone: a suspended member kept passing role guards, and a role
 * named "Owner" in the platform scope satisfied org routes.
 */
const checkRole =
  (scope: PermissionScope, ...roleNames: string[]) =>
  async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated");
      }

      const organizationId =
        scope === PermissionScope.ORGANIZATION
          ? resolveOrganizationIdForRequest(req)
          : null;

      const memberships = await loadScopedMemberships(
        req.user.id,
        scope,
        organizationId
      );

      const hasRole = memberships.some((m) =>
        roleNames.includes(m.role.roleName)
      );

      if (!hasRole) {
        throw new ApiError(403, `Required role: ${roleNames.join(" or ")}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export { checkPermission, requirePermission, checkRole, resolveOrganizationIdForRequest };
