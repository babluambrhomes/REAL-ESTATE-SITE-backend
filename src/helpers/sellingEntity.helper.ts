import prisma from "../config/prisma";
import { ApiError } from "../utils";
import { OrganizationStatus } from "../generated/prisma/enums";

/**
 * Which of the two public selling entities a user already holds.
 *
 * A user is either a person selling under their own name, or the founder of a
 * company selling under the company's name. Not both — see the invariant note
 * on `findExistingSellingEntity`.
 */
export type ExistingSellingEntity =
  | { kind: "INDIVIDUAL_SELLER"; sellerProfileId: string; slug: string }
  | { kind: "ORGANIZATION_OWNER"; organizationId: string; name: string };

/**
 * The individual-seller ↔ organization-owner invariant.
 *
 * There are two ways to become a selling entity on this platform, and each one
 * produces a *public* profile that buyers see, follow, and send enquiries to:
 *
 *   become-seller      → an INDIVIDUAL SellerProfile owned by the user
 *   organizations      → an ORGANIZATION SellerProfile owned by the company,
 *                        with the user as Organization.createdBy (the owner)
 *
 * A user who walks through both ends up with two unrelated public presences
 * for the same brokerage. That is the specific outcome this check exists to
 * prevent, in both directions:
 *
 *   org owner  → become-seller : rejected (the owner acts for the company)
 *   individual → create org    : rejected (the person already sells in their
 *                                       own name)
 *
 * Both directions live here rather than in the two services because the
 * invariant is one fact about the account, and two independent copies of it
 * drift apart the first time one of them is edited.
 *
 * Owning an organization does NOT block becoming an individual seller when the
 * organization is DEACTIVATED — a founder who wound the company down can go
 * back to selling personally. SUSPENDED does still block, since the company is
 * still live and its listings are still the ones being sold through.
 *
 * Note that membership is deliberately NOT checked here: an agent or staff
 * member of a company is free to also be an individual seller, because their
 * selling under their own name is not a second public presence for the
 * company. Only ownership anchors the two together.
 */
export const findExistingSellingEntity = async (
  userId: string
): Promise<ExistingSellingEntity | null> => {
  // Both lookups are independent, so they go out together rather than in the
  // sequential calls these two call sites previously made.
  const [sellerProfile, ownedOrg] = await Promise.all([
    prisma.sellerProfile.findUnique({
      where: { userId },
      select: { id: true, slug: true },
    }),
    prisma.organization.findFirst({
      where: {
        createdBy: userId,
        status: { not: OrganizationStatus.DEACTIVATED },
      },
      select: { id: true, name: true },
    }),
  ]);

  if (sellerProfile) {
    return {
      kind: "INDIVIDUAL_SELLER",
      sellerProfileId: sellerProfile.id,
      slug: sellerProfile.slug,
    };
  }

  if (ownedOrg) {
    return {
      kind: "ORGANIZATION_OWNER",
      organizationId: ownedOrg.id,
      name: ownedOrg.name,
    };
  }

  return null;
};

/**
 * Guards the `become-seller` entry point.
 *
 * A company's listings are claims made by the company, so an owner listing
 * properties under their own name would create a second, unverifiable public
 * presence for the same brokerage.
 */
export const assertCanBecomeIndividualSeller = async (
  userId: string
): Promise<void> => {
  const existing = await findExistingSellingEntity(userId);

  if (existing?.kind === "INDIVIDUAL_SELLER") {
    throw new ApiError(409, "You are already registered as a seller");
  }

  if (existing?.kind === "ORGANIZATION_OWNER") {
    throw new ApiError(
      409,
      `You own the organization "${existing.name}". An organization owner acts on behalf of the company — manage listings from the organization instead of an individual profile.`
    );
  }
};

/**
 * Guards the `POST /organizations` entry point.
 *
 * Owning several organizations is allowed — an agent who runs two brokerages
 * can create both, and `resolveOrgContext` refuses to guess between them. What
 * is not allowed is holding an individual profile alongside them, because that
 * is the one combination that gives a single person two public identities.
 */
export const assertCanCreateOrganization = async (
  userId: string
): Promise<void> => {
  const existing = await findExistingSellingEntity(userId);

  if (existing?.kind === "INDIVIDUAL_SELLER") {
    throw new ApiError(
      409,
      `You already have an individual seller profile (${existing.slug}). An individual seller and a company are two separate public selling entities, and one account cannot hold both — contact support if you need to turn your individual profile into a company.`
    );
  }
};
