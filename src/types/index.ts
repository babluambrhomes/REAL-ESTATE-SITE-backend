import { Request } from "express";
import {
  UserStatus,
  AccountOrigin,
  MemberScope,
  MemberStatus,
  SellerType,
  VerificationStatus,
} from "../generated/prisma/enums";

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  accountOrigin: AccountOrigin;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;

  person: {
    firstName: string;
    lastName: string | null;
    avatarUrl: string | null;
  } | null;

  memberships: {
    id: string;
    scope: MemberScope;
    contextId: string | null;
    status: MemberStatus;
    role: {
      id: string;
      roleName: string;
      isSystemRole: boolean;
    };
  }[];
}

/**
 * Resolved selling context for a request.
 *
 * The important thing this type exists to make explicit: "who is acting"
 * and "which selling entity do they act through" are two DIFFERENT
 * questions, and in this system they frequently have different answers.
 *
 *   Monit, listing his own flat:
 *     userId         = Monit
 *     sellerId       = Monit's INDIVIDUAL seller profile
 *     organizationId = null
 *
 *   Amit, an AGENT at Sharma Realty, creating a property for the company:
 *     userId         = Amit
 *     sellerId       = Sharma Realty's ORGANIZATION seller profile (shared)
 *     organizationId = Sharma Realty
 *
 * Amit can be BOTH at once (an org agent may also be an individual
 * seller). That is why actingContext is never inferred from which
 * profile happens to exist — it is always resolved explicitly.
 */
export interface SellerContext {
  /**
   * The public SELLING ENTITY's SellerProfile id.
   *
   * NOT the acting user's id. For org members this is the org's shared
   * profile. Leads, site visits and buyer questions are addressed to this
   * profile, which is why they keep a `sellerId` even though properties
   * no longer do.
   */
  sellerId: string;

  /** INDIVIDUAL or ORGANIZATION — describes sellerId, not the acting user. */
  sellerType: SellerType;

  /** The authenticated user actually performing the action. */
  userId: string;

  /**
   * Set when acting through an organization, null when acting as an
   * individual seller. This is the discriminator for property ownership:
   * a property belongs to a user, an organization, or both.
   */
  organizationId: string | null;

  /** Active org membership backing this context, null for individual sellers. */
  membershipId: string | null;

  /** Role id of that membership, null for individual sellers. */
  roleId: string | null;

  /** Human-readable role name ("Owner", "Admin", "Agent", "Staff"). */
  roleName: string | null;

  /** Verification state of sellerId. For orgs this is the profile's own state. */
  verificationStatus: VerificationStatus;

  /**
   * Org-only verification state, read from Organization.verificationStatus.
   * null for individual sellers.
   *
   * Org publishing gates on THIS, not on sellerId's verificationStatus,
   * because a company listing is a claim about the company.
   */
  organizationVerificationStatus: VerificationStatus | null;
}

export interface OrgMembershipContext {
  organizationId: string;
  membershipId: string;
  roleId: string;
  roleName: string;
  organizationStatus: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;

  /** Shorthand for `sellerContext.sellerId`, kept for existing callers. */
  sellerId?: string;

  /** Full resolved selling context, set by the seller middlewares. */
  sellerContext?: SellerContext;

  /** Set by the organization middlewares for org administration routes. */
  orgContext?: OrgMembershipContext;

  /** Shorthand for `orgContext.organizationId`. */
  organizationId?: string;

  /** Shorthand for `orgContext.membershipId`. */
  membershipId?: string;

  /** Shorthand for `orgContext.roleId`. */
  orgRoleId?: string;
}
