import crypto from "crypto";
import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import {
  getPaginationParams,
  buildPagination,
  withUniqueRetry,
  generateReferenceCode,
  generateSlug,
  ensureCategory,
  assertCanCreateOrganization,
} from "../../helpers";
import {
  SYSTEM_ORG_ROLES,
  OWNER_ROLE_NAME,
} from "../../seed/permissions.catalog";
import type { Prisma } from "../../generated/prisma/client";
import {
  SellerType,
  SellerStatus,
  MemberScope,
  MemberStatus,
  RoleScope,
  MemberStatus as MemberStatusEnum,
  OrganizationStatus,
  InvitationType,
  InvitationStatus,
  PermissionScope,
} from "../../generated/prisma/enums";
import {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  ListMembersQueryInput,
  UpdateMemberInput,
  InviteMemberInput,
} from "./organization.validation";

/**
 * Organization administration.
 *
 * The distinction this module exists to enforce: a USER owns nothing and a
 * COMPANY owns its listings. Creating an organization therefore cannot be a
 * thin INSERT — it has to produce a coherent set of rows:
 *
 *   1. the Organization
 *   2. its four system roles (Owner, Admin, Agent, Staff) wired to permissions
 *   3. the creator's OWNER membership
 *   4. the organization's single public SellerProfile (user_id NULL)
 *
 * Any one of those missing produces a company that cannot be listed for, or
 * cannot be administered, and the old code path could produce exactly that:
 * an organization whose owner had a SellerProfile but the organization had
 * none. All four are written in one transaction so a partial failure leaves
 * nothing behind.
 */

const DEFAULT_INVITE_TTL_HOURS = 72;

/** Role select used everywhere a role is returned to a client. */
const roleSelect = {
  id: true,
  roleName: true,
  description: true,
  isSystemRole: true,
  isDefault: true,
} as const;

const orgSelect = {
  id: true,
  name: true,
  description: true,
  website: true,
  registrationNumber: true,
  gstNumber: true,
  panNumber: true,
  yearEstablished: true,
  employeeCount: true,
  verificationStatus: true,
  verifiedAt: true,
  status: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  sellerProfile: {
    select: {
      id: true,
      slug: true,
      referenceCode: true,
      verificationStatus: true,
      sellerStatus: true,
      categoryId: true,
    },
  },
} as const;

/**
 * Loads ORGANIZATION-scope permissions from the database, indexed by
 * "resource:action".
 *
 * Read from the DB rather than hardcoded, because role_permissions is the
 * real source of truth for what a role grants. If the seed has not been run,
 * this returns nothing and organization creation fails loudly below — an
 * organization whose roles grant no permissions would look fine and silently
 * lock every one of its members out of their own company.
 */
const loadOrgPermissionIndex = async (): Promise<
  Map<string, { id: string }>
> => {
  const permissions = await prisma.permission.findMany({
    where: { scope: PermissionScope.ORGANIZATION },
    select: { id: true, resource: true, action: true },
  });

  return new Map(
    permissions.map((p) => [`${p.resource}:${p.action}`, { id: p.id }])
  );
};

/**
 * Creates the four system roles for a new organization.
 *
 * Roles are per-organization rows in the same table as platform roles
 * (context_id = org id), so a brokerage can define "Junior Agent" without
 * affecting anyone else. The bundles themselves are shared, from the
 * permission catalogue.
 */
const createSystemRoles = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  createdByUserId: string,
  permissionIndex: Map<string, { id: string }>
): Promise<Map<string, string>> => {
  const roleIds = new Map<string, string>();

  for (const [roleName, bundle] of Object.entries(SYSTEM_ORG_ROLES)) {
    const permissionIds = new Set<string>();
    const missing: string[] = [];

    for (const p of bundle.permissions) {
      const key = `${p.resource}:${p.action}`;
      const match = permissionIndex.get(key);
      if (match) permissionIds.add(match.id);
      else missing.push(key);
    }

    // Never create a role that is missing permissions: it would be created
    // successfully and then quietly deny access on every route it is meant
    // to guard.
    if (missing.length > 0) {
      throw new ApiError(
        503,
        `Cannot create roles: ${missing.length} permission(s) are missing from the database (${missing
          .slice(0, 3)
          .join(", ")}${missing.length > 3 ? ", ..." : ""}). Run the RBAC seed first: npm run prisma:seed`
      );
    }

    const role = await tx.role.create({
      data: {
        scope: RoleScope.ORGANIZATION,
        contextId: organizationId,
        roleName,
        description: bundle.description,
        isSystemRole: true,
        // Agent is the default so an invite sent without a role does not
        // accidentally hand out Owner or Admin.
        isDefault: roleName === "Agent",
        createdBy: createdByUserId,
      },
      select: { id: true },
    });

    await tx.rolePermission.createMany({
      data: [...permissionIds].map((permissionId) => ({
        roleId: role.id,
        permissionId,
      })),
      skipDuplicates: true,
    });

    roleIds.set(roleName, role.id);
  }

  return roleIds;
};

/** Splits organization business fields from public seller profile fields. */
const splitOrgFields = (data: UpdateOrganizationInput) => {
  const {
    name,
    reraNumber,
    categoryId,
    description,
    website,
    registrationNumber,
    gstNumber,
    panNumber,
    yearEstablished,
    employeeCount,
    ...profileFields
  } = data;

  return {
    organization: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(website !== undefined ? { website } : {}),
      ...(registrationNumber !== undefined ? { registrationNumber } : {}),
      ...(gstNumber !== undefined ? { gstNumber } : {}),
      ...(panNumber !== undefined ? { panNumber } : {}),
      ...(yearEstablished !== undefined ? { yearEstablished } : {}),
      ...(employeeCount !== undefined ? { employeeCount } : {}),
    },
    /**
     * reraNumber and categoryId live on the public seller profile, not the
     * organization row, so they are written to `profile`. They were dropped
     * here before: destructured out of `data` and never put back, which made
     * `PATCH /organizations/:id` answer 200 while quietly changing nothing
     * for exactly the two fields an agent needs most when correcting a
     * listing's registration details.
     */
    profile: {
      ...profileFields,
      ...(reraNumber !== undefined ? { reraNumber } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
    },
  };
};

/**
 * Creates an organization, fully wired, in one transaction.
 *
 * The creator becomes the OWNER, and ownership is anchored to
 * Organization.createdBy (see checkOrgOwner) — it is deliberately not
 * transferable in this version, so creating a company is a one-way door and
 * the endpoint is guarded accordingly by the caller.
 *
 * A creator who already sells as an individual is refused, and
 * `becomeSeller` applies the mirror check — see sellingEntity.helper for the
 * invariant and why both entry points have to enforce it. Owning more than one
 * organization is fine; holding an individual profile as well is not.
 */
const createOrganization = async (
  userId: string,
  data: CreateOrganizationInput
) => {
  await assertCanCreateOrganization(userId);

  await ensureCategory(data.categoryId);

  const permissionIndex = await loadOrgPermissionIndex();

  const { reraNumber, categoryId, ...rest } = data;
  const { organization: orgFields, profile } = splitOrgFields(rest);

  return withUniqueRetry(() =>
    prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          ...orgFields,
          name: data.name,
          createdBy: userId,
        },
        select: { id: true, name: true },
      });

      const roleIds = await createSystemRoles(
        tx,
        org.id,
        userId,
        permissionIndex
      );

      const ownerRoleId = roleIds.get(OWNER_ROLE_NAME);
      if (!ownerRoleId) {
        throw new ApiError(500, "Owner role could not be created");
      }

      await tx.member.create({
        data: {
          scope: MemberScope.ORGANIZATION,
          contextId: org.id,
          userId,
          roleId: ownerRoleId,
          status: MemberStatus.ACTIVE,
        },
      });

      // The company's public profile. user_id is explicitly NULL: a company
      // is not its owner, and the CHECK constraint enforces that the profile
      // belongs to the organization and not to a person.
      const sellerProfile = await tx.sellerProfile.create({
        data: {
          userId: null,
          organizationId: org.id,
          sellerType: SellerType.ORGANIZATION,
          referenceCode: generateReferenceCode(),
          slug: generateSlug(data.name),
          sellerStatus: SellerStatus.ACTIVE,
          categoryId,
          ...(reraNumber ? { reraNumber } : {}),
          ...profile,
        },
        select: { id: true, slug: true, referenceCode: true },
      });

      return {
        ...org,
        roles: await tx.role.findMany({
          where: { scope: RoleScope.ORGANIZATION, contextId: org.id },
          select: {
            ...roleSelect,
            _count: { select: { rolePermissions: true, members: true } },
          },
          orderBy: { roleName: "asc" },
        }),
        sellerProfile,
        membership: {
          roleId: ownerRoleId,
          roleName: OWNER_ROLE_NAME,
        },
      };
    })
  );
};

/** Every organization the caller is an ACTIVE member of. */
const listMyOrganizations = async (userId: string) => {
  const memberships = await prisma.member.findMany({
    where: {
      userId,
      scope: MemberScope.ORGANIZATION,
      status: MemberStatus.ACTIVE,
      contextId: { not: null },
    },
    select: {
      id: true,
      contextId: true,
      joinedAt: true,
      organization: { select: orgSelect },
      role: { select: { id: true, roleName: true } },
    },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.flatMap((m) =>
    m.organization && m.contextId !== null
      ? [
          {
            ...m.organization,
            membership: { id: m.id, role: m.role },
          },
        ]
      : []
  );
};

/**
 * Loads an organization the caller is an active member of.
 *
 * Callers must pass their own membership through this path rather than
 * reading an organization by id directly — otherwise any member of any
 * company could read any other company's record.
 */
const getOrganization = async (orgId: string, userId: string) => {
  const membership = await prisma.member.findFirst({
    where: {
      userId,
      scope: MemberScope.ORGANIZATION,
      contextId: orgId,
      status: MemberStatus.ACTIVE,
    },
    select: { role: { select: roleSelect } },
  });

  if (!membership) {
    throw new ApiError(403, "You are not an active member of this organization");
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      ...orgSelect,
      roles: {
        where: { scope: RoleScope.ORGANIZATION },
        select: { ...roleSelect, _count: { select: { members: true } } },
        orderBy: { roleName: "asc" },
      },
    },
  });

  if (!org) {
    throw new ApiError(404, "Organization not found");
  }

  return { ...org, callerRole: membership.role };
};

/**
 * Updates the organization's business details and its public profile.
 *
 * The split matters: company registration data lives on the organization
 * because it is verified at company level, while everything a buyer sees on
 * the public page lives on the seller profile. Writing a GST number to the
 * seller profile would make it invisible to the KYC review that needs it.
 */
const updateOrganization = async (
  orgId: string,
  data: UpdateOrganizationInput,
  actorUserId: string
) => {
  const { organization: orgFields, profile } = splitOrgFields(data);

  await ensureCategory(data.categoryId);

  const existing = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, sellerProfile: { select: { id: true } } },
  });

  if (!existing) {
    throw new ApiError(404, "Organization not found");
  }

  if (!existing.sellerProfile) {
    throw new ApiError(
      409,
      "This organization has no public seller profile. Contact support — it should have been created with the organization."
    );
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(orgFields).length > 0) {
      await tx.organization.update({ where: { id: orgId }, data: orgFields });
    }

    if (Object.keys(profile).length > 0) {
      await tx.sellerProfile.update({
        where: { id: existing.sellerProfile!.id },
        data: profile,
      });
    }
  });

  // Re-read through the membership-scoped path rather than by id, so a
  // request that somehow lost its membership mid-flight cannot get a fresh
  // copy of an organization it no longer belongs to.
  return getOrganization(orgId, actorUserId);
};

/** Paged member list. Removed members stay visible only if explicitly asked. */
const listMembers = async (
  orgId: string,
  query: ListMembersQueryInput
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const { skip, take, page: p, limit: l } = getPaginationParams({ page, limit });

  const where: Prisma.MemberWhereInput = {
    scope: MemberScope.ORGANIZATION,
    contextId: orgId,
    // REMOVED is the default exclusion: a removed member is history, not a
    // roster entry, but must still be re-invitable.
    ...(query.status ? { status: query.status } : { status: { not: MemberStatus.REMOVED } }),
  };

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      skip,
      take,
      orderBy: [{ joinedAt: "desc" }],
      select: {
        id: true,
        status: true,
        joinedAt: true,
        role: { select: roleSelect },
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            status: true,
            person: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    }),
    prisma.member.count({ where }),
  ]);

  return { data: members, ...buildPagination(total, p, l) };
};

/**
 * The organization's roles and what each grants.
 *
 * Permission keys come back with the role so the UI can render a permission
 * matrix from one request, and so an operator can see exactly why a teammate
 * can or cannot do something.
 */
const listRoles = async (orgId: string) => {
  const roles = await prisma.role.findMany({
    where: { scope: RoleScope.ORGANIZATION, contextId: orgId },
    select: {
      ...roleSelect,
      _count: { select: { members: true, rolePermissions: true } },
      rolePermissions: {
        select: {
          permission: {
            select: { resource: true, action: true, displayName: true },
          },
        },
      },
    },
    orderBy: { roleName: "asc" },
  });

  return roles.map((role) => ({
    id: role.id,
    roleName: role.roleName,
    description: role.description,
    isSystemRole: role.isSystemRole,
    isDefault: role.isDefault,
    memberCount: role._count.members,
    permissionCount: role._count.rolePermissions,
    permissions: role.rolePermissions.map((rp) => ({
      key: `${rp.permission.resource}:${rp.permission.action}`,
      displayName: rp.permission.displayName,
    })),
  }));
};

/**
 * Resolves a role for use inside an organization.
 *
 * Scoped to the organization on purpose: a client must not be able to grant a
 * member the platform's Super Admin role, nor a role from a different
 * company, by sending its id.
 */
const resolveOrgRole = async (
  orgId: string,
  roleId?: string,
  roleName?: string
) => {
  const role = await prisma.role.findFirst({
    where: {
      scope: RoleScope.ORGANIZATION,
      contextId: orgId,
      ...(roleId ? { id: roleId } : { roleName }),
    },
    select: roleSelect,
  });

  if (!role) {
    throw new ApiError(400, "That role does not belong to this organization");
  }

  return role;
};

/** The org's owner: created_by, with a matching active membership. */
const loadOwnerMembership = async (orgId: string) => {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { createdBy: true },
  });

  if (!org) {
    throw new ApiError(404, "Organization not found");
  }

  const membership = await prisma.member.findFirst({
    where: {
      scope: MemberScope.ORGANIZATION,
      contextId: orgId,
      userId: org.createdBy,
    },
    select: { id: true, status: true },
  });

  return { ownerUserId: org.createdBy, ownerMembership: membership };
};

/**
 * Changes a member's role or status.
 *
 * Three protections, all deliberate:
 *   - The owner cannot be edited. Ownership is anchored to created_by and is
 *     not transferable, so allowing the owner's role or status to change would
 *     leave an organization whose owner cannot administer it, with no way to
 *     fix it.
 *   - Nobody can change their own role. Self-promotion to Admin (or demotion
 *     that strands them) should not be a one-request operation.
 *   - Status can only move to ACTIVE or SUSPENDED. REMOVED is the terminal
 *     state and is set by removeMember, so a "suspend" cannot quietly become
 *     a removal.
 */
const updateMember = async (
  orgId: string,
  memberId: string,
  actorUserId: string,
  data: UpdateMemberInput
) => {
  const { ownerUserId } = await loadOwnerMembership(orgId);

  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      scope: MemberScope.ORGANIZATION,
      contextId: orgId,
    },
    select: { id: true, userId: true, status: true, role: { select: roleSelect } },
  });

  if (!member) {
    throw new ApiError(404, "Member not found in this organization");
  }

  if (member.userId === ownerUserId) {
    throw new ApiError(
      403,
      "The organization owner's role cannot be changed"
    );
  }

  if (member.userId === actorUserId) {
    throw new ApiError(403, "You cannot change your own role");
  }

  const role = data.roleId
    ? await resolveOrgRole(orgId, data.roleId)
    : undefined;

  // Assigning the Owner role by hand would create a second person who looks
  // like the owner while the real owner stays created_by — a split-brain
  // ownership state. Ownership transfer is not supported in this version.
  if (role?.roleName === OWNER_ROLE_NAME) {
    throw new ApiError(
      403,
      "The Owner role cannot be assigned. Organization ownership is not transferable."
    );
  }

  const updated = await prisma.member.update({
    where: { id: member.id },
    data: {
      ...(role ? { roleId: role.id } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
    select: {
      id: true,
      status: true,
      joinedAt: true,
      role: { select: roleSelect },
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          person: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      },
    },
  });

  return updated;
};

/**
 * Removes a member from the organization.
 *
 * Sets status to REMOVED rather than deleting the row: leads, site visits and
 * buyer questions are assigned to a member id, and deleting it would either
 * cascade away a sales history or orphan those assignments.
 */
const removeMember = async (
  orgId: string,
  memberId: string,
  actorUserId: string
) => {
  const { ownerUserId } = await loadOwnerMembership(orgId);

  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      scope: MemberScope.ORGANIZATION,
      contextId: orgId,
    },
    select: { id: true, userId: true },
  });

  if (!member) {
    throw new ApiError(404, "Member not found in this organization");
  }

  if (member.userId === ownerUserId) {
    throw new ApiError(403, "The organization owner cannot be removed");
  }

  if (member.userId === actorUserId) {
    throw new ApiError(403, "You cannot remove yourself");
  }

  await prisma.member.update({
    where: { id: member.id },
    data: { status: MemberStatusEnum.REMOVED },
  });

  return { removed: true, memberId: member.id };
};

/** Resolves which role an invite should grant. */
const resolveInviteRole = async (
  orgId: string,
  roleId?: string,
  roleName?: string
) => {
  if (roleId || roleName) {
    const role = await resolveOrgRole(orgId, roleId, roleName);
    if (role.roleName === OWNER_ROLE_NAME) {
      throw new ApiError(403, "The Owner role cannot be granted by invitation");
    }
    return role;
  }

  const fallback = await prisma.role.findFirst({
    where: {
      scope: RoleScope.ORGANIZATION,
      contextId: orgId,
      isDefault: true,
    },
    select: roleSelect,
  });

  if (!fallback) {
    throw new ApiError(
      500,
      "This organization has no default role. Specify roleId or roleName."
    );
  }

  return fallback;
};

/**
 * Invites someone to join the organization.
 *
 * Creating the invitation does not create the membership — the member row
 * appears only when the invitation is accepted, so a pending invite cannot
 * grant access, and revoking an invite is just deleting it.
 */
const inviteMember = async (
  orgId: string,
  invitedByUserId: string,
  data: InviteMemberInput
) => {
  const role = await resolveInviteRole(orgId, data.roleId, data.roleName);

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
    select: {
      id: true,
      email: true,
      person: { select: { firstName: true, lastName: true } },
    },
  });

  if (existingUser) {
    const existingMember = await prisma.member.findFirst({
      where: {
        scope: MemberScope.ORGANIZATION,
        contextId: orgId,
        userId: existingUser.id,
      },
      select: { id: true, status: true },
    });

    /**
     * Only a still-present membership blocks a new invite.
     *
     * A REMOVED row is deliberately re-invitable: it is the audit trail of
     * someone who used to work here, and leaving it as a permanent barrier
     * makes off-boarding irreversible — a company that fires the wrong
     * account could never get that person back in, short of manual DB work.
     * acceptInvitation() already revives a REMOVED membership on acceptance,
     * so refusing the invite here would have contradicted it.
     *
     * The membership row is left untouched; it is only revived when the
     * invitee actually accepts, so a pending invite alone grants nothing.
     */
    if (existingMember && existingMember.status !== MemberStatus.REMOVED) {
      throw new ApiError(
        409,
        `${existingUser.email} is already a member of this organization`
      );
    }
  }

  // One live invite per email per organization. Without this, two invites
  // could exist and the second acceptance would fail on the partial unique
  // index rather than at invite time.
  await prisma.invitation.updateMany({
    where: {
      organizationId: orgId,
      email: data.email,
      status: InvitationStatus.PENDING,
    },
    data: { status: InvitationStatus.CANCELLED },
  });

  const ttlHours = data.expiresInHours ?? DEFAULT_INVITE_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      invitationType: InvitationType.ORGANIZATION_MEMBER,
      email: data.email,
      phone: data.phone,
      // 32 bytes of CSPRNG output, URL safe. This token IS the credential
      // for joining the company, so it must not be a timestamp or a counter.
      token: crypto.randomBytes(32).toString("hex"),
      invitedBy: invitedByUserId,
      organizationId: orgId,
      roleId: role.id,
      status: InvitationStatus.PENDING,
      expiresAt,
    },
    select: {
      id: true,
      token: true,
      email: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      role: { select: roleSelect },
      organization: { select: { id: true, name: true } },
    },
  });

  return {
    ...invitation,
    // The token is returned once, to the inviter, so the API can hand the
    // link to whatever mailer is wired up. Invite acceptance still requires
    // the token, so this is not a privilege escalation.
    inviteLink: `/api/v1/organizations/invitations/accept?token=${invitation.token}`,
    isExistingUser: Boolean(existingUser),
  };
};

const listInvitations = async (orgId: string) => {
  return prisma.invitation.findMany({
    where: {
      organizationId: orgId,
      invitationType: InvitationType.ORGANIZATION_MEMBER,
      status: { not: InvitationStatus.CANCELLED },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      phone: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      createdAt: true,
      role: { select: roleSelect },
      acceptedByUser: {
        select: {
          id: true,
          email: true,
          person: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
};

const cancelInvitation = async (orgId: string, invitationId: string) => {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId: orgId },
    select: { id: true, status: true },
  });

  if (!invitation) {
    throw new ApiError(404, "Invitation not found");
  }

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new ApiError(
      409,
      `This invitation is already ${invitation.status.toLowerCase()}`
    );
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: InvitationStatus.CANCELLED },
  });

  return { cancelled: true, invitationId: invitation.id };
};

/**
 * Accepts an invitation, creating the membership.
 *
 * Three gates, in this order, because they answer different questions:
 *   1. does the token exist and is it usable at all (pending, not expired)?
 *   2. is it addressed to the person accepting? A leaked link must not let
 *      the recipient's colleague join the company.
 *   3. may this person join (not already a member)?
 *
 * Only then is anything written, and the membership plus the invitation's
 * state change together so a crash cannot leave a usable invite that has
 * already been consumed.
 */
const acceptInvitation = async (token: string, userId: string) => {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      status: true,
      expiresAt: true,
      organizationId: true,
      roleId: true,
      invitationType: true,
      acceptedBy: true,
      organization: { select: { id: true, name: true, status: true } },
      role: { select: roleSelect },
    },
  });

  if (!invitation) {
    throw new ApiError(404, "This invitation is not valid");
  }

  if (invitation.invitationType !== InvitationType.ORGANIZATION_MEMBER) {
    throw new ApiError(400, "This is not an organization invitation");
  }

  if (invitation.status === InvitationStatus.ACCEPTED) {
    throw new ApiError(409, "This invitation has already been accepted");
  }

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new ApiError(
      409,
      `This invitation is ${invitation.status.toLowerCase()} and can no longer be accepted`
    );
  }

  if (invitation.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(410, "This invitation has expired. Ask for a new one.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.email || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new ApiError(
      403,
      `This invitation was sent to ${invitation.email}. Sign in with that email address to accept it.`
    );
  }

  if (!invitation.organizationId || !invitation.organization) {
    throw new ApiError(409, "This invitation is not linked to an organization");
  }

  if (invitation.organization.status !== OrganizationStatus.ACTIVE) {
    throw new ApiError(
      403,
      "This organization is not active and cannot accept new members"
    );
  }

  const alreadyMember = await prisma.member.findFirst({
    where: {
      scope: MemberScope.ORGANIZATION,
      contextId: invitation.organizationId,
      userId,
    },
    select: { id: true, status: true },
  });

  if (alreadyMember && alreadyMember.status !== MemberStatus.REMOVED) {
    throw new ApiError(
      409,
      "You are already a member of this organization"
    );
  }

  return prisma.$transaction(async (tx) => {
    if (alreadyMember) {
      // Re-invite after removal: the partial unique index still holds the
      // old row, so reactivate it instead of inserting a duplicate.
      await tx.member.update({
        where: { id: alreadyMember.id },
        data: { roleId: invitation.roleId, status: MemberStatus.ACTIVE },
      });
    } else {
      await tx.member.create({
        data: {
          scope: MemberScope.ORGANIZATION,
          contextId: invitation.organizationId,
          userId,
          roleId: invitation.roleId,
          status: MemberStatus.ACTIVE,
        },
      });
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedBy: userId,
        acceptedAt: new Date(),
      },
    });

    return {
      organization: invitation.organization,
      role: invitation.role,
      membership: { status: MemberStatus.ACTIVE },
    };
  });
};

/** Pending invitations addressed to the caller, for their "join" screen. */
const listMyInvitations = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) {
    return [];
  }

  return prisma.invitation.findMany({
    where: {
      email: user.email.toLowerCase(),
      invitationType: InvitationType.ORGANIZATION_MEMBER,
      status: InvitationStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      createdAt: true,
      role: { select: roleSelect },
      organization: {
        select: { id: true, name: true, logoUrl: true },
      },
      invitedByUser: {
        select: { person: { select: { firstName: true, lastName: true } } },
      },
    },
  });
};

export {
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
  roleSelect,
};
