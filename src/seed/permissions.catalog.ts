
export type PermissionScope = "PLATFORM" | "ORGANIZATION" | "INDIVIDUAL";

export interface PermissionDef {
  scope: PermissionScope;
  resource: string;
  action: string;
  displayName: string;
  description: string;
}

const permission = (
  scope: PermissionScope,
  resource: string,
  action: string,
  displayName: string,
  description: string
): PermissionDef => ({
  scope,
  resource,
  action,
  displayName,
  description,
});

/* =========================================================
   PLATFORM PERMISSIONS
   Super Admin / Platform Admin / Staff / Support
========================================================= */

const PLATFORM_PERMISSIONS: PermissionDef[] = [
  // Dashboard
  permission("PLATFORM", "dashboard", "read", "View Dashboard", "Access platform dashboard"),
  permission("PLATFORM", "dashboard", "analytics", "View Dashboard Analytics", "View platform statistics"),

  // Users
  permission("PLATFORM", "user", "read", "View Users", "View all user accounts"),
  permission("PLATFORM", "user", "create", "Create Users", "Create user accounts"),
  permission("PLATFORM", "user", "update", "Edit Users", "Update user details"),
  permission("PLATFORM", "user", "suspend", "Suspend Users", "Suspend or reactivate users"),
  permission("PLATFORM", "user", "delete", "Delete Users", "Soft delete user accounts"),
  permission("PLATFORM", "user", "restore", "Restore Users", "Restore deleted users"),
  permission("PLATFORM", "user", "verify", "Verify Users", "Verify user accounts"),
  permission("PLATFORM", "user", "export", "Export Users", "Export user data"),

  // Sellers
  permission("PLATFORM", "seller", "read", "View Sellers", "View all seller profiles"),
  permission("PLATFORM", "seller", "create", "Create Sellers", "Create seller profiles"),
  permission("PLATFORM", "seller", "update", "Edit Sellers", "Edit seller profiles"),
  permission("PLATFORM", "seller", "verify", "Verify Sellers", "Approve seller KYC"),
  permission("PLATFORM", "seller", "reject", "Reject Sellers", "Reject seller verification"),
  permission("PLATFORM", "seller", "suspend", "Suspend Sellers", "Suspend seller accounts"),
  permission("PLATFORM", "seller", "delete", "Delete Sellers", "Soft delete seller profiles"),
  permission("PLATFORM", "seller", "restore", "Restore Sellers", "Restore seller profiles"),
  permission("PLATFORM", "seller", "export", "Export Sellers", "Export seller data"),

  // Organizations
  permission("PLATFORM", "organization", "read", "View Organizations", "View all organizations"),
  permission("PLATFORM", "organization", "create", "Create Organizations", "Create organizations"),
  permission("PLATFORM", "organization", "update", "Edit Organizations", "Edit organization details"),
  permission("PLATFORM", "organization", "verify", "Verify Organizations", "Approve organization KYC"),
  permission("PLATFORM", "organization", "reject", "Reject Organizations", "Reject organization verification"),
  permission("PLATFORM", "organization", "suspend", "Suspend Organizations", "Suspend organizations"),
  permission("PLATFORM", "organization", "delete", "Delete Organizations", "Soft delete organizations"),
  permission("PLATFORM", "organization", "restore", "Restore Organizations", "Restore organizations"),
  permission("PLATFORM", "organization", "export", "Export Organizations", "Export organization data"),

  // Properties
  permission("PLATFORM", "property", "read", "View All Properties", "View all listings including drafts"),
  permission("PLATFORM", "property", "create", "Create Properties", "Create property listings"),
  permission("PLATFORM", "property", "update", "Edit Any Property", "Edit any property"),
  permission("PLATFORM", "property", "verify", "Verify Properties", "Approve property listings"),
  permission("PLATFORM", "property", "reject", "Reject Properties", "Reject property listings"),
  permission("PLATFORM", "property", "publish", "Publish Properties", "Publish property listings"),
  permission("PLATFORM", "property", "unpublish", "Unpublish Properties", "Unpublish property listings"),
  permission("PLATFORM", "property", "feature", "Feature Properties", "Feature property listings"),
  permission("PLATFORM", "property", "delete", "Delete Properties", "Soft delete properties"),
  permission("PLATFORM", "property", "restore", "Restore Properties", "Restore deleted properties"),
  permission("PLATFORM", "property", "export", "Export Properties", "Export property data"),

  // Leads
  permission("PLATFORM", "lead", "read", "View All Leads", "View leads across all sellers"),
  permission("PLATFORM", "lead", "create", "Create Leads", "Create leads"),
  permission("PLATFORM", "lead", "update", "Update Leads", "Update lead details and status"),
  permission("PLATFORM", "lead", "assign", "Assign Leads", "Assign leads"),
  permission("PLATFORM", "lead", "delete", "Delete Leads", "Soft delete leads"),
  permission("PLATFORM", "lead", "restore", "Restore Leads", "Restore deleted leads"),
  permission("PLATFORM", "lead", "export", "Export Leads", "Export lead data"),

  // Site Visits
  permission("PLATFORM", "siteVisit", "read", "View All Site Visits", "View all site visits"),
  permission("PLATFORM", "siteVisit", "create", "Create Site Visits", "Create site visits"),
  permission("PLATFORM", "siteVisit", "update", "Update Site Visits", "Update site visits"),
  permission("PLATFORM", "siteVisit", "assign", "Assign Site Visits", "Assign site visits"),
  permission("PLATFORM", "siteVisit", "delete", "Delete Site Visits", "Delete site visits"),
  permission("PLATFORM", "siteVisit", "export", "Export Site Visits", "Export site visit data"),

  // Buyer Questions
  permission("PLATFORM", "buyerQuestion", "read", "View All Questions", "View all buyer questions"),
  permission("PLATFORM", "buyerQuestion", "answer", "Answer Questions", "Answer buyer questions"),
  permission("PLATFORM", "buyerQuestion", "assign", "Assign Questions", "Assign questions"),
  permission("PLATFORM", "buyerQuestion", "delete", "Delete Questions", "Delete buyer questions"),

  // Reviews and ratings
  permission("PLATFORM", "review", "read", "View Reviews", "View all reviews"),
  permission("PLATFORM", "review", "update", "Moderate Reviews", "Moderate reviews"),
  permission("PLATFORM", "review", "approve", "Approve Reviews", "Approve reviews"),
  permission("PLATFORM", "review", "reject", "Reject Reviews", "Reject reviews"),
  permission("PLATFORM", "review", "delete", "Delete Reviews", "Delete reviews"),

  // Media and videos
  permission("PLATFORM", "media", "read", "View Media", "View uploaded media"),
  permission("PLATFORM", "media", "delete", "Delete Media", "Delete uploaded media"),
  permission("PLATFORM", "video", "read", "View Videos", "View uploaded videos"),
  permission("PLATFORM", "video", "update", "Manage Videos", "Manage platform videos"),
  permission("PLATFORM", "video", "delete", "Delete Videos", "Delete uploaded videos"),

  // Seller categories
  permission("PLATFORM", "category", "read", "View Categories", "View seller categories"),
  permission("PLATFORM", "category", "manage", "Manage Categories", "Create, update and reorder categories"),
  permission("PLATFORM", "category", "delete", "Delete Categories", "Delete categories"),

  // CMS and content
  permission("PLATFORM", "blogPost", "read", "View Blog Posts", "View blog posts"),
  permission("PLATFORM", "blogPost", "manage", "Manage Blog Posts", "Create, edit and publish blogs"),
  permission("PLATFORM", "blogPost", "delete", "Delete Blog Posts", "Delete blog posts"),

  permission("PLATFORM", "page", "manage", "Manage Pages", "Manage website pages"),
  permission("PLATFORM", "banner", "manage", "Manage Banners", "Manage website banners"),
  permission("PLATFORM", "happyCustomer", "manage", "Manage Happy Customers", "Manage customer stories"),
  permission("PLATFORM", "testimonial", "manage", "Manage Testimonials", "Manage testimonials"),
  permission("PLATFORM", "faq", "manage", "Manage FAQs", "Manage frequently asked questions"),

  // Payments and subscriptions
  permission("PLATFORM", "payment", "read", "View Payments", "View platform payments"),
  permission("PLATFORM", "payment", "manage", "Manage Payments", "Manage payment records"),
  permission("PLATFORM", "payment", "refund", "Process Refunds", "Process payment refunds"),
  permission("PLATFORM", "payment", "export", "Export Payments", "Export payment records"),

  permission("PLATFORM", "subscription", "read", "View Subscriptions", "View subscriptions"),
  permission("PLATFORM", "subscription", "manage", "Manage Subscriptions", "Manage subscription plans"),
  permission("PLATFORM", "subscription", "cancel", "Cancel Subscriptions", "Cancel subscriptions"),

  // Platform roles and staff
  permission("PLATFORM", "role", "read", "View Platform Roles", "View platform roles"),
  permission("PLATFORM", "role", "manage", "Manage Platform Roles", "Create and update platform roles"),
  permission("PLATFORM", "permission", "read", "View Permissions", "View permission catalogue"),
  permission("PLATFORM", "permission", "manage", "Manage Permissions", "Manage platform permissions"),

  permission("PLATFORM", "invitation", "read", "View Invitations", "View staff invitations"),
  permission("PLATFORM", "invitation", "manage", "Manage Invitations", "Invite and manage platform staff"),

  // Reports and analytics
  permission("PLATFORM", "report", "read", "View Reports", "View platform reports"),
  permission("PLATFORM", "report", "export", "Export Reports", "Export reports"),
  permission("PLATFORM", "analytics", "read", "View Analytics", "View platform analytics"),

  // Notifications
  permission("PLATFORM", "notification", "read", "View Notifications", "View platform notifications"),
  permission("PLATFORM", "notification", "manage", "Manage Notifications", "Manage notifications"),
  permission("PLATFORM", "email", "manage", "Manage Emails", "Manage email templates"),
  permission("PLATFORM", "sms", "manage", "Manage SMS", "Manage SMS templates"),

  // Settings and security
  permission("PLATFORM", "settings", "read", "View Settings", "View platform settings"),
  permission("PLATFORM", "settings", "manage", "Manage Settings", "Update platform settings"),
  permission("PLATFORM", "auditLog", "read", "View Audit Logs", "View audit history"),
  permission("PLATFORM", "security", "manage", "Manage Security", "Manage platform security settings"),
];

/* =========================================================
   COMMON SELLER PERMISSIONS
   ORGANIZATION + INDIVIDUAL
========================================================= */

const getSellerPermissions = (
  scope: "ORGANIZATION" | "INDIVIDUAL"
): PermissionDef[] => [
  // Dashboard
  permission(scope, "dashboard", "read", "View Dashboard", "View seller dashboard"),
  permission(scope, "dashboard", "analytics", "View Analytics", "View seller analytics"),

  // Properties
  permission(scope, "property", "create", "Create Properties", "Create new property listings"),
  permission(scope, "property", "read", "View Properties", "View own properties"),
  permission(scope, "property", "update", "Edit Properties", "Edit property details"),
  permission(scope, "property", "delete", "Delete Properties", "Soft delete properties"),
  permission(scope, "property", "publish", "Publish Properties", "Publish property listings"),
  permission(scope, "property", "unpublish", "Unpublish Properties", "Unpublish property listings"),
  permission(scope, "property", "restore", "Restore Properties", "Restore deleted properties"),
  permission(scope, "property", "feature", "Feature Properties", "Request or manage featured listings"),
  permission(scope, "property", "export", "Export Properties", "Export property data"),

  // Leads
  permission(scope, "lead", "create", "Create Leads", "Create new leads"),
  permission(scope, "lead", "read", "View Leads", "View leads received on own properties"),
  permission(scope, "lead", "update", "Update Leads", "Update lead details and status"),
  permission(scope, "lead", "delete", "Delete Leads", "Soft delete leads"),
  permission(scope, "lead", "export", "Export Leads", "Export lead data"),

  // Site Visits
  permission(scope, "siteVisit", "create", "Create Site Visits", "Schedule site visits"),
  permission(scope, "siteVisit", "read", "View Site Visits", "View property site visits"),
  permission(scope, "siteVisit", "update", "Update Site Visits", "Update site visit status"),
  permission(scope, "siteVisit", "delete", "Delete Site Visits", "Delete site visits"),
  permission(scope, "siteVisit", "export", "Export Site Visits", "Export site visit data"),

  // Buyer Questions
  permission(scope, "buyerQuestion", "read", "View Buyer Questions", "View questions on own listings"),
  permission(scope, "buyerQuestion", "answer", "Answer Buyer Questions", "Answer buyer questions"),
  permission(scope, "buyerQuestion", "delete", "Delete Buyer Questions", "Delete buyer questions"),

  // Seller profile
  permission(scope, "sellerProfile", "read", "View Seller Profile", "View own seller profile"),
  permission(scope, "sellerProfile", "update", "Edit Seller Profile", "Edit profile, photo, logo and cover"),
  permission(scope, "sellerProfile", "publish", "Publish Seller Profile", "Publish seller profile"),

  // Media and videos
  permission(scope, "media", "upload", "Upload Media", "Upload property images and documents"),
  permission(scope, "media", "read", "View Media", "View uploaded media"),
  permission(scope, "media", "delete", "Delete Media", "Delete own uploaded media"),
  permission(scope, "video", "upload", "Upload Videos", "Upload property videos"),
  permission(scope, "video", "read", "View Videos", "View uploaded videos"),
  permission(scope, "video", "delete", "Delete Videos", "Delete own videos"),

  // KYC
  permission(scope, "kyc", "update", "Update KYC", "Update verification documents"),

  // Reviews
  permission(scope, "review", "read", "View Reviews", "View seller reviews"),
  permission(scope, "review", "reply", "Reply to Reviews", "Reply to customer reviews"),

  // Reports
  permission(scope, "report", "read", "View Reports", "View property and lead reports"),
  permission(scope, "report", "export", "Export Reports", "Export seller reports"),

  // Notifications
  permission(scope, "notification", "read", "View Notifications", "View notifications"),
  permission(scope, "notification", "update", "Manage Notifications", "Manage notification preferences"),

  // Account settings
  permission(scope, "settings", "read", "View Settings", "View account settings"),
  permission(scope, "settings", "update", "Update Settings", "Update account settings"),

  // Enquiry preferences
  permission(scope, "enquirySettings", "read", "View Enquiry Settings", "View enquiry preferences"),
  permission(scope, "enquirySettings", "update", "Manage Enquiry Settings", "Manage enquiry preferences"),
];

/* =========================================================
   ORGANIZATION PERMISSIONS
   Common Seller Permissions + Team Management
========================================================= */

const ORGANIZATION_PERMISSIONS: PermissionDef[] = [
  ...getSellerPermissions("ORGANIZATION"),

  // Organization details
  permission("ORGANIZATION", "organization", "read", "View Organization", "View organization details"),
  permission("ORGANIZATION", "organization", "update", "Edit Organization", "Edit organization details"),
  permission("ORGANIZATION", "organization", "delete", "Delete Organization", "Request organization deletion"),

  // Team Management - Organization only
  permission("ORGANIZATION", "member", "read", "View Members", "View organization team members"),
  permission("ORGANIZATION", "member", "invite", "Invite Members", "Invite new team members"),
  permission("ORGANIZATION", "member", "update", "Edit Members", "Update member details and roles"),
  permission("ORGANIZATION", "member", "remove", "Remove Members", "Remove members from organization"),
  permission("ORGANIZATION", "member", "suspend", "Suspend Members", "Suspend or reactivate members"),
  permission("ORGANIZATION", "member", "restore", "Restore Members", "Restore removed members"),

  // Roles and permissions
  permission("ORGANIZATION", "role", "read", "View Roles", "View organization roles"),
  permission("ORGANIZATION", "role", "create", "Create Roles", "Create custom roles"),
  permission("ORGANIZATION", "role", "update", "Edit Roles", "Edit custom roles"),
  permission("ORGANIZATION", "role", "manage", "Manage Roles", "Manage roles and permissions"),
  permission("ORGANIZATION", "role", "delete", "Delete Roles", "Delete custom roles"),

  permission("ORGANIZATION", "permission", "read", "View Permissions", "View organization permissions"),
  permission("ORGANIZATION", "permission", "manage", "Manage Permissions", "Assign permissions to roles"),

  // Team assignment
  permission("ORGANIZATION", "lead", "assign", "Assign Leads", "Assign leads to team members"),
  permission("ORGANIZATION", "siteVisit", "assign", "Assign Site Visits", "Assign visits to team members"),
  permission("ORGANIZATION", "buyerQuestion", "assign", "Assign Buyer Questions", "Assign questions to team members"),

  // Team activity
  permission("ORGANIZATION", "team", "read", "View Team Activity", "View team activity"),
  permission("ORGANIZATION", "team", "manage", "Manage Team", "Manage organization team"),

  // Organization KYC
  permission("ORGANIZATION", "kyc", "read", "View Company KYC", "View organization KYC"),
  permission("ORGANIZATION", "kyc", "submit", "Submit Company KYC", "Submit company documents"),

  // Billing
  permission("ORGANIZATION", "billing", "read", "View Billing", "View organization billing"),
  permission("ORGANIZATION", "billing", "manage", "Manage Billing", "Manage billing details"),
  permission("ORGANIZATION", "subscription", "read", "View Subscription", "View organization subscription"),
  permission("ORGANIZATION", "subscription", "manage", "Manage Subscription", "Manage organization subscription"),
];

/* =========================================================
   INDIVIDUAL PERMISSIONS
   Same Common Seller Permissions
   No Team Management
========================================================= */

const INDIVIDUAL_PERMISSIONS: PermissionDef[] = [
  ...getSellerPermissions("INDIVIDUAL"),

  // Individual account
  permission("INDIVIDUAL", "account", "read", "View Account", "View personal account details"),
  permission("INDIVIDUAL", "account", "update", "Update Account", "Update personal account details"),
  permission("INDIVIDUAL", "account", "delete", "Delete Account", "Request account deletion"),

  // Personal KYC
  permission("INDIVIDUAL", "kyc", "read", "View Personal KYC", "View personal verification status"),
  permission("INDIVIDUAL", "kyc", "submit", "Submit Personal KYC", "Submit personal KYC documents"),

  // Personal billing
  permission("INDIVIDUAL", "billing", "read", "View Billing", "View personal billing details"),
  permission("INDIVIDUAL", "billing", "manage", "Manage Billing", "Manage personal billing details"),
  permission("INDIVIDUAL", "subscription", "read", "View Subscription", "View personal subscription"),
  permission("INDIVIDUAL", "subscription", "manage", "Manage Subscription", "Manage personal subscription"),
];

/* =========================================================
   MASTER PERMISSION CATALOGUE
========================================================= */

export const PERMISSIONS: PermissionDef[] = [
  ...PLATFORM_PERMISSIONS,
  ...ORGANIZATION_PERMISSIONS,
  ...INDIVIDUAL_PERMISSIONS,
];

/* =========================================================
   PERMISSION KEYS
========================================================= */

export const PLATFORM_PERMISSION_KEYS = new Set(
  PLATFORM_PERMISSIONS.map((p) => `${p.resource}:${p.action}`)
);

export const ORGANIZATION_PERMISSION_KEYS = new Set(
  ORGANIZATION_PERMISSIONS.map((p) => `${p.resource}:${p.action}`)
);

export const INDIVIDUAL_PERMISSION_KEYS = new Set(
  INDIVIDUAL_PERMISSIONS.map((p) => `${p.resource}:${p.action}`)
);

export const OWNER_ONLY_ORG_PERMISSION_KEYS = new Set([
  "member:invite",
  "member:update",
  "member:remove",
]);

/* =========================================================
   SYSTEM ROLES
========================================================= */

export const SYSTEM_ORG_ROLES = {
  "Organization Owner": {
    description: "Full control of the organization, including properties, team, roles, permissions and billing",
    permissions: ORGANIZATION_PERMISSIONS,
  },
} as const;

export type SystemOrgRoleName = keyof typeof SYSTEM_ORG_ROLES;

export const OWNER_ROLE_NAME = "Organization Owner";

export const INDIVIDUAL_ROLE_NAME = "Individual";

export const PLATFORM_ROLE_NAME = "Platform Owner";
