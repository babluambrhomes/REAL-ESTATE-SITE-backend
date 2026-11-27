import { z } from "zod";
import {
  OWNER_ONLY_ORG_PERMISSION_KEYS,
  ORGANIZATION_PERMISSION_KEYS,
} from "../../seed/permissions.catalog";

/**
 * The public seller profile fields an organization can set on its own public
 * page. Identical to the individual seller's fields, because buyers see one
 * page per selling entity and should not have to care which it is.
 */
const orgProfileFields = {
  headline: z.string().max(200).trim().optional(),
  about: z.string().max(5000).trim().optional(),
  experienceYears: z.number().int().min(0).max(150).optional(),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  addressLine: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  contactPhone: z.string().min(7).max(15).trim().optional(),
  contactEmail: z.string().email("Enter a valid email").trim().toLowerCase().optional(),
  showContactToBuyers: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  responseTimeMinutes: z.number().int().min(0).optional(),
  availabilityDetails: z.record(z.string(), z.any()).optional(),
  locations: z.array(z.any()).optional(),
  achievements: z.array(z.any()).optional(),
  socialLinks: z.array(z.any()).optional(),
  leadPreferences: z.record(z.string(), z.any()).optional(),
};

/** Company identity and registration details, stored on the organization. */
const orgBusinessFields = {
  description: z.string().max(5000).trim().optional(),
  website: z.string().url("Enter a valid website URL").trim().optional(),
  registrationNumber: z.string().trim().max(100).optional(),
  gstNumber: z.string().trim().max(20).optional(),
  panNumber: z.string().trim().max(20).optional(),
  yearEstablished: z.number().int().min(1800).max(2100).optional(),
  employeeCount: z.number().int().min(1).optional(),
};

/**
 * Creating an organization.
 *
 * There is no sellerType field and no nested organization object — this
 * endpoint is only ever about a company. The company's public seller
 * profile, its Owner role and the creator's OWNER membership are all
 * created server-side in one transaction; the client cannot choose to skip
 * them, which is what previously allowed an organization to exist with no
 * public profile at all.
 */
export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(200, "Organization name must be at most 200 characters")
    .trim(),

  /** The company's RERA registration. Legally required on the public page. */
  reraNumber: z.string().trim().max(50).optional(),

  /** Every selling entity needs a category, so this is required. */
  categoryId: z.string().uuid("Invalid category"),

  ...orgBusinessFields,
  ...orgProfileFields,
});

/** Partial by design — PATCH semantics, and nothing here is mandatory. */
export const updateOrganizationSchema = z
  .object({
    name: z.string().min(2).max(200).trim().optional(),
    reraNumber: z.string().trim().max(50).optional(),
    categoryId: z.string().uuid("Invalid category").optional(),
    ...orgBusinessFields,
    ...orgProfileFields,
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Provide at least one field to update",
  });

export const listMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
});

/**
 * Changing a member's role or status.
 *
 * At least one of roleId / status must be present, and both are validated
 * against the target organization in the service — a client cannot name a
 * role belonging to another company or the platform.
 */
export const updateMemberSchema = z
  .object({
    roleId: z.string().uuid("Invalid role").optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  })
  .refine((d) => d.roleId !== undefined || d.status !== undefined, {
    message: "Provide roleId or status to update",
  });

/**
 * Inviting someone into the organization.
 *
 * The role is identified by id (preferred, what the UI lists) or name
 * (convenient for scripts). Either way the service resolves it against this
 * organization only.
 */
export const inviteMemberSchema = z
  .object({
    email: z.string().email("Enter a valid email").trim().toLowerCase(),
    phone: z.string().min(7).max(15).trim().optional(),
    roleId: z.string().uuid("Invalid role").optional(),
    roleName: z.string().trim().min(1).max(100).optional(),
    expiresInHours: z.number().int().min(1).max(720).optional(),
  })
  .refine((data) => Boolean(data.roleId || data.roleName), {
    message: "Select a role for this invitation",
    path: ["roleId"],
  });

/**
 * Accepting an invitation.
 *
 * The token is the entire payload. Its length is checked here so an empty or
 * truncated token is a clear 400 instead of a generic "invitation not valid".
 */
export const acceptInvitationSchema = z.object({
  token: z.string().min(16, "Invitation token is required").trim(),
});

const rolePermissionKeys = z
  .array(
    z
      .string()
      .refine((key) => ORGANIZATION_PERMISSION_KEYS.has(key), {
        message: "Unknown organization permission",
      })
      .refine((key) => !OWNER_ONLY_ORG_PERMISSION_KEYS.has(key), {
        message: "Reserved for the organization owner",
      })
  )
  .min(1, "A role must grant at least one permission")
  .max(ORGANIZATION_PERMISSION_KEYS.size, "Unknown organization permission");

const roleNameField = z
  .string()
  .min(2, "Role name must be at least 2 characters")
  .max(100, "Role name must be at most 100 characters")
  .trim()
  .refine((name) => name.toLowerCase() !== "owner", {
    message: "Owner is a reserved role name",
  });

export const createRoleSchema = z.object({
  roleName: roleNameField,
  description: z.string().max(500).trim().optional(),
  permissions: rolePermissionKeys,
});

export const updateRoleSchema = z
  .object({
    roleName: roleNameField.optional(),
    description: z.string().max(500).trim().optional(),
    permissions: rolePermissionKeys.optional(),
  })
  .refine((d) => d.roleName !== undefined || d.description !== undefined || d.permissions !== undefined, {
    message: "Provide at least one field to update",
  });

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type ListMembersQueryInput = z.infer<typeof listMembersQuerySchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
