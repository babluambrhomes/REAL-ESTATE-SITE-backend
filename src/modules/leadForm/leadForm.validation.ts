import { z } from "zod";

export const leadStatuses = [
  "NEW",
  "CONTACTED",
  "SITE_VISIT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export const leadSources = [
  "ENQUIRY_FORM",
  "WHATSAPP",
  "CALL_NOW",
  "REQUEST_CALL_BACK",
  "CONTACT",
] as const;

export const createLeadSchema = z
  .object({
    sellerId: z.string().uuid("Invalid seller").optional(),
    organizationId: z.string().uuid("Invalid organization").optional(),
    propertyId: z.string().uuid("Invalid property").optional(),
    // Lead kahan se aaya — frontend explicit bhejta hai; absent hone par default ENQUIRY_FORM
    source: z.enum(leadSources).optional(),
    // Login mandatory hai → name/email/phone profile se auto-fill honge;
    // body me bheje values override karte hain. Email optional.
    name: z.string().min(2, "Name must be at least 2 characters").max(200).trim().optional(),
    email: z.string().email("Enter a valid email").trim().toLowerCase().optional(),
    phone: z.string().min(6, "Phone must be at least 6 characters").max(20).trim().optional(),
    message: z.string().max(2000).trim().optional(),
  })
  .refine((data) => Boolean(data.sellerId || data.organizationId || data.propertyId), {
    message: "sellerId, organizationId or propertyId is required",
    path: ["sellerId"],
  });

export const updateLeadStatusSchema = z.object({
  status: z.enum(leadStatuses),
});

export const updateLeadCommentSchema = z.object({
  comment: z.string().min(1, "Comment is required").max(5000).trim(),
});

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(leadStatuses).optional(),
  source: z.enum(leadSources).optional(),
  propertyId: z.string().uuid("Invalid property").optional(),
});

export const leadIdParamsSchema = z.object({
  id: z.string().uuid("Invalid lead id"),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;
export type UpdateLeadCommentInput = z.infer<typeof updateLeadCommentSchema>;
export type ListLeadsQueryInput = z.infer<typeof listLeadsQuerySchema>;
export type LeadIdParams = z.infer<typeof leadIdParamsSchema>;