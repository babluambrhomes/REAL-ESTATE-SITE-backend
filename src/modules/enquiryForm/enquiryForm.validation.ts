import { z } from "zod";

export const enquiryStatuses = [
  "NEW",
  "CONTACTED",
  "SITE_VISIT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export const enquirySources = ["SELLER_PROFILE", "PROPERTY"] as const;

export const submitEnquirySchema = z.object({
  sellerId: z.string().uuid("Invalid seller").optional(),
  organizationId: z.string().uuid("Invalid organization").optional(),
  propertyId: z.string().uuid("Invalid property").optional(),
  name: z.string().min(2, "Name is required").max(200).trim(),
  email: z.string().email("Enter a valid email").trim().toLowerCase(),
  phone: z.string().max(20).trim().optional(),
  message: z.string().max(2000).trim().optional(),
});

export const updateEnquiryStatusSchema = z.object({
  status: z.enum(enquiryStatuses),
});

export const updateEnquiryCommentSchema = z.object({
  comment: z.string().min(1, "Comment is required").max(5000).trim(),
});

export const listEnquiriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(enquiryStatuses).optional(),
  source: z.enum(enquirySources).optional(),
  propertyId: z.string().uuid("Invalid property").optional(),
});

export type SubmitEnquiryInput = z.infer<typeof submitEnquirySchema>;
export type UpdateEnquiryStatusInput = z.infer<typeof updateEnquiryStatusSchema>;
export type UpdateEnquiryCommentInput = z.infer<typeof updateEnquiryCommentSchema>;
export type ListEnquiriesQueryInput = z.infer<typeof listEnquiriesQuerySchema>;