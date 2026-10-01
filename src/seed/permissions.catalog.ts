/**
 * The permission catalogue.
 *
 * This is the single source of truth for what the system considers a
 * distinct capability. Roles are just bundles of these, so if a capability
 * is not listed here it does not exist — which is a much better failure
 * mode than inventing ad-hoc `resource:action` strings in route files.
 *
 * Two rules the catalogue enforces structurally:
 *
 *  1. Scope matters. A PLATFORM permission and an ORGANIZATION permission
 *     with the same resource/action are DIFFERENT permissions. `member:invite`
 *     for a company owner must never be satisfied by a platform Super Admin's
 *     membership, and vice versa.
 *
 *  2. Permissions are referenced as `"<resource>:<<action>"` strings in
 *     route guards. Those strings are the contract between this file and
 *     `checkPermission()`, so renaming one silently breaks authorisation
 *     at runtime rather than at compile time. The seed validates every
 *     permission actually referenced in the codebase against this
 *     catalogue (see scripts/verify-permissions.ts) to catch that.
 */

export type PermissionScope = "PLATFORM" | "ORGANIZATION";

export interface PermissionDef {
  scope: PermissionScope;
  resource: string;
  action: string;
  displayName: string;
  description: string;
}

/**
 * Platform-side capabilities. Held by PLATFORM-scope roles only
 * (Super Admin, Platform Staff, Support Agent).
 */
const PLATFORM_PERMISSIONS: PermissionDef[] = [
  // --- Users ---
  { scope: "PLATFORM", resource: "user", action: "read", displayName: "View Users", description: "See any user account and its profile" },
  { scope: "PLATFORM", resource: "user", action: "update", displayName: "Edit Users", description: "Edit another user's account details" },
  { scope: "PLATFORM", resource: "user", action: "suspend", displayName: "Suspend Users", description: "Suspend or reactivate a user account" },
  { scope: "PLATFORM", resource: "user", action: "delete", displayName: "Delete Users", description: "Soft delete a user account" },

  // --- Sellers ---
  { scope: "PLATFORM", resource: "seller", action: "read", displayName: "View Sellers", description: "See any seller profile" },
  { scope: "PLATFORM", resource: "seller", action: "update", displayName: "Edit Sellers", description: "Edit a seller profile" },
  { scope: "PLATFORM", resource: "seller", action: "verify", displayName: "Verify Sellers", description: "Approve a seller's KYC documents" },
  { scope: "PLATFORM", resource: "seller", action: "reject", displayName: "Reject Sellers", description: "Reject a seller's KYC documents with a reason" },
  { scope: "PLATFORM", resource: "seller", action: "suspend", displayName: "Suspend Sellers", description: "Suspend a seller account" },

  // --- Organizations ---
  { scope: "PLATFORM", resource: "organization", action: "read", displayName: "View Organizations", description: "See any organization" },
  { scope: "PLATFORM", resource: "organization", action: "update", displayName: "Edit Organizations", description: "Edit an organization's business details" },
  { scope: "PLATFORM", resource: "organization", action: "verify", displayName: "Verify Organizations", description: "Approve a company's KYC documents" },
  { scope: "PLATFORM", resource: "organization", action: "reject", displayName: "Reject Organizations", description: "Reject a company's KYC documents with a reason" },
  { scope: "PLATFORM", resource: "organization", action: "suspend", displayName: "Suspend Organizations", description: "Suspend or reactivate an organization" },

  // --- Properties ---
  { scope: "PLATFORM", resource: "property", action: "read", displayName: "View All Properties", description: "See every property including unpublished ones" },
  { scope: "PLATFORM", resource: "property", action: "update", displayName: "Edit Any Property", description: "Edit a property on a seller's behalf" },
  { scope: "PLATFORM", resource: "property", action: "verify", displayName: "Verify Properties", description: "Mark a property as verified" },
  { scope: "PLATFORM", resource: "property", action: "reject", displayName: "Reject Properties", description: "Reject a property listing" },
  { scope: "PLATFORM", resource: "property", action: "delete", displayName: "Delete Properties", description: "Soft delete any property listing" },
  { scope: "PLATFORM", resource: "property", action: "feature", displayName: "Feature Properties", description: "Mark a property as featured" },

  // --- Enquiries ---
  { scope: "PLATFORM", resource: "lead", action: "read", displayName: "View All Leads", description: "See leads across all sellers" },
  { scope: "PLATFORM", resource: "lead", action: "update", displayName: "Update Leads", description: "Change a lead's status" },
  { scope: "PLATFORM", resource: "lead", action: "delete", displayName: "Delete Leads", description: "Delete a lead" },
  { scope: "PLATFORM", resource: "siteVisit", action: "read", displayName: "View All Site Visits", description: "See site visits across all sellers" },
  { scope: "PLATFORM", resource: "siteVisit", action: "update", displayName: "Update Site Visits", description: "Change a site visit's status" },
  { scope: "PLATFORM", resource: "siteVisit", action: "delete", displayName: "Delete Site Visits", description: "Delete a site visit" },
  { scope: "PLATFORM", resource: "buyerQuestion", action: "read", displayName: "View All Questions", description: "See buyer questions across all sellers" },
  { scope: "PLATFORM", resource: "buyerQuestion", action: "answer", displayName: "Answer Any Question", description: "Answer a buyer question" },
  { scope: "PLATFORM", resource: "buyerQuestion", action: "delete", displayName: "Delete Any Question", description: "Delete a buyer question" },

  // --- Content & catalogue ---
  { scope: "PLATFORM", resource: "category", action: "manage", displayName: "Manage Seller Categories", description: "Create, edit and reorder seller categories" },
  { scope: "PLATFORM", resource: "blogPost", action: "manage", displayName: "Manage Blog Posts", description: "Create, edit and archive blog posts" },

  // --- Platform administration ---
  { scope: "PLATFORM", resource: "role", action: "manage", displayName: "Manage Platform Roles", description: "Create and edit platform roles and their permissions" },
  { scope: "PLATFORM", resource: "permission", action: "manage", displayName: "Manage Permissions", description: "Grant and revoke platform permissions" },
  { scope: "PLATFORM", resource: "invitation", action: "manage", displayName: "Manage Platform Invitations", description: "Invite and manage platform staff" },
  { scope: "PLATFORM", resource: "settings", action: "manage", displayName: "Manage Platform Settings", description: "Change platform-wide configuration" },
  { scope: "PLATFORM", resource: "report", action: "read", displayName: "View Reports", description: "View platform analytics and reports" },
  { scope: "PLATFORM", resource: "report", action: "export", displayName: "Export Reports", description: "Export reports as CSV or PDF" },
  { scope: "PLATFORM", resource: "auditLog", action: "read", displayName: "View Audit Log", description: "Read the platform audit trail" },
];

/**
 * Organization-side capabilities. Held by ORGANIZATION-scope roles only
 * (Owner, Admin, Agent, Staff, plus any custom roles an org creates).
 */
const ORGANIZATION_PERMISSIONS: PermissionDef[] = [
  // --- Properties ---
  { scope: "ORGANIZATION", resource: "property", action: "create", displayName: "Create Properties", description: "Add new property listings for the organization" },
  { scope: "ORGANIZATION", resource: "property", action: "read", displayName: "View Properties", description: "See all of the organization's properties" },
  { scope: "ORGANIZATION", resource: "property", action: "update", displayName: "Edit Properties", description: "Edit any of the organization's properties" },
  { scope: "ORGANIZATION", resource: "property", action: "delete", displayName: "Delete Properties", description: "Soft delete any of the organization's properties" },
  { scope: "ORGANIZATION", resource: "property", action: "publish", displayName: "Publish Properties", description: "Move a property from draft to published" },

  // --- Enquiries ---
  { scope: "ORGANIZATION", resource: "lead", action: "read", displayName: "View Leads", description: "See leads for the organization's properties" },
  { scope: "ORGANIZATION", resource: "lead", action: "update", displayName: "Update Leads", description: "Change a lead's status" },
  { scope: "ORGANIZATION", resource: "lead", action: "assign", displayName: "Assign Leads", description: "Assign a lead to a team member" },
  { scope: "ORGANIZATION", resource: "lead", action: "delete", displayName: "Delete Leads", description: "Delete a lead" },
  { scope: "ORGANIZATION", resource: "lead", action: "export", displayName: "Export Leads", description: "Export leads to CSV" },
  { scope: "ORGANIZATION", resource: "siteVisit", action: "read", displayName: "View Site Visits", description: "See site visits for the organization's properties" },
  { scope: "ORGANIZATION", resource: "siteVisit", action: "update", displayName: "Update Site Visits", description: "Change a site visit's status" },
  { scope: "ORGANIZATION", resource: "siteVisit", action: "assign", displayName: "Assign Site Visits", description: "Assign a site visit to a team member" },
  { scope: "ORGANIZATION", resource: "siteVisit", action: "delete", displayName: "Delete Site Visits", description: "Delete a site visit" },
  { scope: "ORGANIZATION", resource: "buyerQuestion", action: "read", displayName: "View Buyer Questions", description: "See questions asked about the organization's properties" },
  { scope: "ORGANIZATION", resource: "buyerQuestion", action: "answer", displayName: "Answer Buyer Questions", description: "Answer buyer questions" },
  { scope: "ORGANIZATION", resource: "buyerQuestion", action: "assign", displayName: "Assign Buyer Questions", description: "Assign a question to a team member" },
  { scope: "ORGANIZATION", resource: "buyerQuestion", action: "delete", displayName: "Delete Buyer Questions", description: "Delete a buyer question" },

  // --- Team ---
  { scope: "ORGANIZATION", resource: "member", action: "read", displayName: "View Members", description: "See the organization's member list" },
  { scope: "ORGANIZATION", resource: "member", action: "invite", displayName: "Invite Members", description: "Invite new members to the organization" },
  { scope: "ORGANIZATION", resource: "member", action: "update", displayName: "Edit Members", description: "Change a member's role or suspend them" },
  { scope: "ORGANIZATION", resource: "member", action: "remove", displayName: "Remove Members", description: "Remove a member from the organization" },

  // --- Roles & permissions ---
  { scope: "ORGANIZATION", resource: "role", action: "read", displayName: "View Roles", description: "See the organization's roles and their permissions" },
  { scope: "ORGANIZATION", resource: "role", action: "manage", displayName: "Manage Roles", description: "Create and edit custom roles and assign permissions" },

  // --- Organization administration ---
  { scope: "ORGANIZATION", resource: "organization", action: "read", displayName: "View Organization", description: "See the organization's business details" },
  { scope: "ORGANIZATION", resource: "organization", action: "update", displayName: "Edit Organization", description: "Edit the organization's business details" },
  { scope: "ORGANIZATION", resource: "kyc", action: "submit", displayName: "Submit Company KYC", description: "Upload and submit the company's verification documents" },
  { scope: "ORGANIZATION", resource: "kyc", action: "read", displayName: "View Company KYC", description: "See the company's verification status and documents" },
  { scope: "ORGANIZATION", resource: "report", action: "read", displayName: "View Reports", description: "View the organization's performance reports" },
  { scope: "ORGANIZATION", resource: "report", action: "export", displayName: "Export Reports", description: "Export the organization's reports" },
];

export const PERMISSIONS: PermissionDef[] = [
  ...PLATFORM_PERMISSIONS,
  ...ORGANIZATION_PERMISSIONS,
];

export const PLATFORM_PERMISSION_KEYS = new Set(
  PLATFORM_PERMISSIONS.map((p) => `${p.resource}:${p.action}`)
);

export const ORGANIZATION_PERMISSION_KEYS = new Set(
  ORGANIZATION_PERMISSIONS.map((p) => `${p.resource}:${p.action}`)
);

/**
 * Default permission bundles for the four system org roles.
 *
 * These are applied when an organization is created. The hierarchy is
 * strictly additive — Owner ⊇ Admin ⊇ Agent ⊇ Staff — because in a small
 * brokerage the Owner is usually also the Agent, and the Owner is often
 * answering their own site visits at 11pm.
 */
export const SYSTEM_ORG_ROLES = {
  Owner: {
    description: "Full control of the organization, including roles and billing",
    permissions: ORGANIZATION_PERMISSIONS,
  },
  Admin: {
    description: "Manages day-to-day operations, team and listings",
    permissions: ORGANIZATION_PERMISSIONS.filter(
      (p) => !(p.resource === "role" && p.action === "manage")
    ),
  },
  Agent: {
    description: "Handles listings and buyer enquiries they are assigned",
    permissions: ORGANIZATION_PERMISSIONS.filter((p) =>
      [
        "property:create",
        "property:read",
        "property:update",
        "property:publish",
        "lead:read",
        "lead:update",
        "siteVisit:read",
        "siteVisit:update",
        "buyerQuestion:read",
        "buyerQuestion:answer",
        "kyc:read",
      ].includes(`${p.resource}:${p.action}`)
    ),
  },
  Staff: {
    description: "Read-only access to listings and enquiries",
    permissions: ORGANIZATION_PERMISSIONS.filter((p) =>
      [
        "property:read",
        "lead:read",
        "siteVisit:read",
        "buyerQuestion:read",
        "kyc:read",
      ].includes(`${p.resource}:${p.action}`)
    ),
  },
} as const;

export type SystemOrgRoleName = keyof typeof SYSTEM_ORG_ROLES;

/**
 * The Owner role name is stored on the organization and is what
 * `checkOrgOwner` compares against. Kept here so the seed, the org
 * creation service and the middleware cannot drift apart.
 */
export const OWNER_ROLE_NAME = "Owner";
