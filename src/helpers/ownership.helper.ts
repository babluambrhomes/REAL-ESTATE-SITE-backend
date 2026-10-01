import { ApiError } from "../utils";
import { Prisma } from "../generated/prisma/client";
import { ListingStatus } from "../generated/prisma/enums";
import { AuthRequest, SellerContext } from "../types";

/**
 * "Not soft-deleted."
 *
 * Replaces the old `deletedAt: null` filter. Note this is deliberately NOT
 * `listingStatus: PUBLISHED` — a seller must still be able to open and
 * edit their own PAUSED or DRAFT listings, they just should not show up
 * in public listings.
 */
export const NOT_DELETED: Prisma.PropertyWhereInput = {
  listingStatus: { not: ListingStatus.DELETED },
};

/**
 * The set of properties the acting context is allowed to manage.
 *
 * This is the single source of truth for property ownership. It lives in
 * one helper because getting it subtly wrong in four different services
 * is exactly how a seller ends up editing a competitor's listing.
 *
 *   INDIVIDUAL  → user_id = me AND organization_id IS NULL
 *                 (explicitly NOT org_id: a company agent who is also an
 *                  individual seller must not quietly inherit the whole
 *                  company portfolio by browsing their own listings)
 *
 *   ORGANIZATION→ organization_id = the org
 *                 (not user_id = me: every member manages the whole
 *                  company's portfolio, not just what they personally
 *                  created — otherwise an org's listings would become
 *                  unmanageable as staff rotate)
 */
export const ownedPropertyWhere = (ctx: SellerContext): Prisma.PropertyWhereInput =>
  ctx.organizationId
    ? { organizationId: ctx.organizationId, ...NOT_DELETED }
    : { userId: ctx.userId, organizationId: null, ...NOT_DELETED };

/** ownedPropertyWhere + extra filters, for list queries. */
export const ownedPropertyWhereWith = (
  ctx: SellerContext,
  extra: Prisma.PropertyWhereInput
): Prisma.PropertyWhereInput => ({ ...ownedPropertyWhere(ctx), ...extra });

/** Narrows a property relation filter down to owned properties. */
export const ownedPropertyRelation = (ctx: SellerContext): Prisma.PropertyWhereInput =>
  ownedPropertyWhere(ctx);

/**
 * Pulls the resolved selling context off the request.
 *
 * Replaces the `(req as any).sellerId` pattern that was scattered across
 * every controller. Failing loudly here beats letting `undefined` flow
 * into a Prisma `where` clause and quietly match nothing.
 */
export const requireSellerContext = (req: AuthRequest): SellerContext => {
  if (!req.sellerContext) {
    throw new ApiError(
      401,
      "Not authenticated as a seller — this route requires a seller or organization session"
    );
  }
  return req.sellerContext;
};

/**
 * Guards against a request trying to write into an organization it is not
 * acting through.
 *
 * `organizationId` in a request body is a *selector*, not a value to
 * store. The stored value always comes from the resolved context, so this
 * only has to confirm the two agree.
 */
export const assertRequestedOrgMatchesContext = (
  ctx: SellerContext,
  requestedOrganizationId?: string | null
): void => {
  if (!requestedOrganizationId) return;

  if (!ctx.organizationId) {
    throw new ApiError(
      400,
      "You are not acting through an organization, so organizationId cannot be set here"
    );
  }
  if (ctx.organizationId !== requestedOrganizationId) {
    throw new ApiError(403, "You are not an active member of this organization");
  }
};

/**
 * The columns needed to render a property's public seller identity.
 *
 * Property no longer points at a SellerProfile directly, so the profile
 * has to be reached through whichever side owns it: `user.sellerProfile`
 * for individual sellers, `organization.sellerProfile` for companies.
 * Exactly one of the two is ever populated (enforced by a CHECK).
 */
export const sellerIdentitySelect = {
  id: true,
  referenceCode: true,
  slug: true,
  sellerType: true,
  headline: true,
  logoUrl: true,
  sellerStatus: true,
  verificationStatus: true,
} satisfies Prisma.SellerProfileSelect;

export type SellerIdentity = {
  id: string;
  referenceCode: string;
  slug: string;
  sellerType: string;
  headline: string | null;
  logoUrl: string | null;
  sellerStatus: string;
  verificationStatus: string;
};

/**
 * Resolves the single public-facing seller for a property.
 *
 * Org properties prefer the org profile; individual properties use the
 * user's own. Returns null rather than throwing because a property can
 * outlive a deleted seller profile and the public page should still load
 * with the listing — just without a seller card.
 */
export const resolveSellerIdentity = (property: {
  user?: { sellerProfile?: SellerIdentity | null } | null;
  organization?: { sellerProfile?: SellerIdentity | null } | null;
}): SellerIdentity | null =>
  property.organization?.sellerProfile ?? property.user?.sellerProfile ?? null;
