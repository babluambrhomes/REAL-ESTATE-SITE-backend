import { z } from "zod";

const profileFields = {
  headline: z.string().max(200).trim().optional(),
  about: z.string().max(5000).trim().optional(),
  experienceYears: z.number().int().min(0).max(100).optional(),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  categoryId: z.string().uuid("Invalid category").optional(),
  addressLine: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  contactPhone: z.string().min(7).max(15).trim().optional(),
  contactEmail: z.string().email("Enter a valid email").trim().toLowerCase().optional(),
  showContactToBuyers: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  happyClientsCount: z.number().int().min(0).optional(),
  responseTimeMinutes: z.number().int().min(0).optional(),
  availabilityDetails: z.record(z.string(), z.any()).optional(),
  videos: z.array(z.any()).optional(),
  locations: z.array(z.any()).optional(),
  bankApprovalList: z.array(z.any()).optional(),
  achievements: z.array(z.any()).optional(),
  socialLinks: z.array(z.any()).optional(),
  leadPreferences: z.record(z.string(), z.any()).optional(),
};

/**
 * Individual seller onboarding only.
 *
 * Companies do NOT come through here. An organization is created by
 * POST /organizations, which sets up the company, its roles and its owner's
 * membership in one transaction. Having both paths write a SellerProfile
 * meant the two could disagree about who owns the public profile, so the
 * company branch was removed from this schema entirely.
 */
export const becomeSellerSchema = z.object({
  /** Display name; also becomes the person's first name if it differs. */
  name: z.string().min(2).max(200).trim().optional(),
  panNumber: z.string().trim().max(20).optional(),
  aadhaarNumber: z.string().trim().max(20).optional(),
  reraNumber: z.string().trim().max(50).optional(),
  ...profileFields,
  categoryId: z.string().uuid("Invalid category"),
});

/**
 * Updating an individual profile. Companies edit their own business details
 * through PATCH /organizations/:orgId.
 */
export const updateSellerSchema = z.object({
  name: z.string().min(2).max(200).trim().optional(),
  panNumber: z.string().trim().max(20).optional(),
  aadhaarNumber: z.string().trim().max(20).optional(),
  reraNumber: z.string().trim().max(50).optional(),
  ...profileFields,
});

export const updateSlugSchema = z.object({
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug must be at most 100 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase with hyphens")
    .trim(),
});

export type BecomeSellerInput = z.infer<typeof becomeSellerSchema>;
export type UpdateSellerInput = z.infer<typeof updateSellerSchema>;
export type UpdateSlugInput = z.infer<typeof updateSlugSchema>;
