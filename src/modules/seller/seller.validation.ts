import { z } from "zod";

const organizationSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters").max(200).trim(),
  description: z.string().max(5000).trim().optional(),
  website: z.string().url("Enter a valid website URL").trim().optional(),
  registrationNumber: z.string().trim().optional(),
  gstNumber: z.string().trim().optional(),
  yearEstablished: z.number().int().min(1900).max(2100).optional(),
  employeeCount: z.number().int().min(1).optional(),
});

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

export const becomeSellerSchema = z
  .object({
    sellerType: z.enum(["INDIVIDUAL", "ORGANIZATION"]),
    name: z.string().min(2).max(200).trim().optional(),
    panNumber: z.string().trim().max(20).optional(),
    aadhaarNumber: z.string().trim().max(20).optional(),
    reraNumber: z.string().trim().max(50).optional(),
    organization: organizationSchema.optional(),
    ...profileFields,
    categoryId: z.string().uuid("Invalid category"),
  })
  .refine(
    (d) => {
      if (d.sellerType === "ORGANIZATION" && !d.name && !d.organization?.name) {
        return false;
      }
      return true;
    },
    { message: "Organization name is required" }
  );

export const updateSellerSchema = z.object({
  name: z.string().min(2).max(200).trim().optional(),
  panNumber: z.string().trim().max(20).optional(),
  aadhaarNumber: z.string().trim().max(20).optional(),
  reraNumber: z.string().trim().max(50).optional(),
  organization: organizationSchema.optional(),
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
