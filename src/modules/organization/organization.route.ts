import { Router } from "express";
import {
  createOrganization,
  listMyOrganizations,
  getOrganization,
  updateOrganization,
  listMembers,
  listRoles,
  updateMember,
  removeMember,
  inviteMember,
  listInvitations,
  cancelInvitation,
  acceptInvitation,
  listMyInvitations,
} from "./organization.controller";
import {
  protect,
  validate,
  parseQuery,
  checkOrgMembership,
  checkOrgOwner,
  requirePermission,
} from "../../middlewares";
import { PermissionScope } from "../../generated/prisma/enums";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  listMembersQuerySchema,
  updateMemberSchema,
  inviteMemberSchema,
  acceptInvitationSchema,
} from "./organization.validation";

const router = Router();

/**
 * Organization administration.
 *
 * Two layers guard every org-scoped route:
 *
 *   checkOrgMembership  — is the caller an ACTIVE member of :orgId, and is
 *                         the organization itself still ACTIVE?
 *   requirePermission   — does their role actually grant this capability,
 *                         checked within that same organization?
 *
 * Both run on purpose. Membership alone is too coarse (every member can
 * read the org record, which is correct), and permission alone would have to
 * re-derive membership anyway. The pair makes "who is asking" and "may they
 * do this" separate, auditable decisions.
 */

const orgMemberGuard = requirePermission(
  PermissionScope.ORGANIZATION,
  "member:read"
);
const orgInviteGuard = requirePermission(
  PermissionScope.ORGANIZATION,
  "member:invite"
);

// --- My organizations -------------------------------------------------------

router.get("/", protect, listMyOrganizations);
router.post("/", protect, validate(createOrganizationSchema), createOrganization);

// --- Invitations addressed to me -------------------------------------------

router.get("/invitations/mine", protect, listMyInvitations);

router.post(
  "/invitations/accept",
  protect,
  validate(acceptInvitationSchema),
  acceptInvitation
);

// --- A single organization --------------------------------------------------

router.get("/:orgId", protect, checkOrgMembership, getOrganization);

router.patch(
  "/:orgId",
  protect,
  checkOrgMembership,
  requirePermission(PermissionScope.ORGANIZATION, "organization:update"),
  validate(updateOrganizationSchema),
  updateOrganization
);

// --- Roles ------------------------------------------------------------------

router.get(
  "/:orgId/roles",
  protect,
  checkOrgMembership,
  requirePermission(PermissionScope.ORGANIZATION, "role:read"),
  listRoles
);

// --- Members ----------------------------------------------------------------

router.get(
  "/:orgId/members",
  protect,
  checkOrgMembership,
  orgMemberGuard,
  parseQuery(listMembersQuerySchema),
  listMembers
);

router.patch(
  "/:orgId/members/:memberId",
  protect,
  checkOrgMembership,
  requirePermission(PermissionScope.ORGANIZATION, "member:update"),
  validate(updateMemberSchema),
  updateMember
);

router.delete(
  "/:orgId/members/:memberId",
  protect,
  checkOrgMembership,
  requirePermission(PermissionScope.ORGANIZATION, "member:remove"),
  removeMember
);

// --- Invitations for an organization ---------------------------------------

router.get(
  "/:orgId/invitations",
  protect,
  checkOrgMembership,
  orgInviteGuard,
  listInvitations
);

router.post(
  "/:orgId/invitations",
  protect,
  checkOrgMembership,
  orgInviteGuard,
  validate(inviteMemberSchema),
  inviteMember
);

/**
 * Cancelling an invite requires the owner, not just `member:invite`.
 *
 * Withdrawing an invitation someone already acted on is a different act from
 * sending a new one, and it is the kind of thing an org should be able to
 * restrict — a compromised Admin account should not be able to quietly drop
 * the founder's pending invite.
 */
router.delete(
  "/:orgId/invitations/:invitationId",
  protect,
  checkOrgOwner,
  orgInviteGuard,
  cancelInvitation
);

export default router;
