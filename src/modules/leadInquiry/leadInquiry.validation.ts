import { z } from "zod";

export const inquiryTypes = ["GENERAL", "ORGANIZATION_INQUIRY", "SITE_VISIT"] as const;

export const pipelineStatuses = [
  "NEW",
  "CONTACTED",
  "SITE_VISIT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export const visitStatuses = [
  "NEW",
  "CONFIRMED",
  "RESCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const allStatuses = [
  "NEW",
  "CONTACTED",
  "SITE_VISIT",
  "NEGOTIATION",
  "WON",
  "LOST",
  "CONFIRMED",
  "RESCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const inquirySources = [
  "ENQUIRY_FORM",
  "WHATSAPP",
  "CALL_NOW",
  "REQUEST_CALL_BACK",
  "CONTACT",
] as const;

export const allowedStatusesForType = (type: string): readonly string[] =>
  type === "SITE_VISIT" ? visitStatuses : pipelineStatuses;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

const isoDateString = z
  .string()
  .trim()
  .regex(ISO_DATE, "Invalid date (expected YYYY-MM-DD)")
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00.000Z`).getTime()), "Invalid date");

const isoDateTimeString = z
  .string()
  .trim()
  .regex(ISO_DATETIME, "Invalid date-time (expected ISO format)")
  .refine((v) => !Number.isNaN(new Date(v.replace(" ", "T")).getTime()), "Invalid date-time");

const toDate = (v: string): Date =>
  ISO_DATE.test(v) ? new Date(`${v}T00:00:00.000Z`) : new Date(v.replace(" ", "T"));

const visitTimeShape = {
  visitDate: isoDateString,
  startTime: isoDateTimeString,
  endTime: isoDateTimeString.optional(),
};

const toVisitDates = <T extends { visitDate: string; startTime: string; endTime?: string }>(
  data: T
) => ({
  ...data,
  visitDate: toDate(data.visitDate),
  startTime: toDate(data.startTime),
  endTime: data.endTime ? toDate(data.endTime) : undefined,
});

const endTimeAfterStart = (d: { startTime: string; endTime?: string }) =>
  !d.endTime || new Date(d.endTime) > new Date(d.startTime);

const startTimeInFuture = (d: { startTime: string }) => new Date(d.startTime) > new Date();

const targetRefine = (data: {
  sellerId?: string;
  organizationId?: string;
  propertyId?: string;
}) => Boolean(data.sellerId || data.organizationId || data.propertyId);

const contactShape = {
  name: z.string().min(2, "Name must be at least 2 characters").max(200).trim().optional(),
  email: z.string().email("Enter a valid email").trim().toLowerCase().optional(),
  phone: z.string().min(6, "Phone must be at least 6 characters").max(20).trim().optional(),
  message: z.string().max(2000, "Message must be at most 2000 characters").trim().optional(),
};

const targetShape = {
  sellerId: z.string().uuid("Invalid seller").optional(),
  organizationId: z.string().uuid("Invalid organization").optional(),
  propertyId: z.string().uuid("Invalid property").optional(),
};

/**
 * General lead — property/seller/org me se koi ek target chahiye.
 * name/phone optional because login required; service profile se fallback karta hai.
 */
export const createGeneralLeadSchema = z
  .object({
    ...targetShape,
    source: z.enum(inquirySources).optional(),
    ...contactShape,
  })
  .refine(targetRefine, {
    message: "sellerId, organizationId or propertyId is required",
    path: ["sellerId"],
  });

/**
 * Organization inquiry — consent enforced, org required.
 */
export const createOrganizationInquirySchema = z.object({
  organizationId: z.string().uuid("Invalid organization"),
  ...contactShape,
  budgetRange: z.string().max(200, "Budget must be at most 200 characters").trim().optional(),
  preferredProject: z
    .string()
    .max(300, "Preferred project must be at most 300 characters")
    .trim()
    .optional(),
  termsAccepted: z.literal(true, {
    error: "You must agree to the Terms & Conditions",
  }),
});

/**
 * Site visit — target + future visit window required.
 */
export const createSiteVisitSchema = z
  .object({
    ...targetShape,
    source: z.enum(inquirySources).optional(),
    ...contactShape,
    userAddress: z.string().max(500).trim().optional(),
    ...visitTimeShape,
  })
  .refine(targetRefine, {
    message: "sellerId, organizationId or propertyId is required",
    path: ["sellerId"],
  })
  .refine(endTimeAfterStart, { message: "endTime must be after startTime", path: ["endTime"] })
  .refine(startTimeInFuture, { message: "Visit time must be in the future", path: ["startTime"] })
  .transform(toVisitDates);

export const updateStatusSchema = z.object({
  status: z.enum(allStatuses),
  comment: z.string().max(5000).trim().optional(),
});

export const addCommentSchema = z.object({
  comment: z.string().min(1, "Comment is required").max(5000).trim(),
});

export const assignSchema = z.object({
  memberId: z.string().uuid("Invalid member").nullable(),
});

export const rescheduleSchema = z
  .object({
    ...visitTimeShape,
    comment: z.string().max(5000).trim().optional(),
  })
  .refine(endTimeAfterStart, { message: "endTime must be after startTime", path: ["endTime"] })
  .refine(startTimeInFuture, { message: "Visit time must be in the future", path: ["startTime"] })
  .transform(toVisitDates);

export const cancelSchema = z.object({
  reason: z.string().max(2000).trim().optional(),
});

export const listLeadInquiriesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    type: z.enum(inquiryTypes).optional(),
    status: z.enum(allStatuses).optional(),
    source: z.enum(inquirySources).optional(),
    propertyId: z.string().uuid("Invalid property").optional(),
    assignedToMemberId: z.string().uuid("Invalid member").optional(),
    from: isoDateTimeString.optional(),
    to: isoDateTimeString.optional(),
    upcoming: z
      .enum(["true", "false", "1", "0"])
      .transform((v) => v === "true" || v === "1")
      .optional(),
  })
  .transform((data) => ({
    ...data,
    from: data.from ? toDate(data.from) : undefined,
    to: data.to ? toDate(data.to) : undefined,
  }));

export const leadInquiryIdParamsSchema = z.object({
  id: z.string().uuid("Invalid lead inquiry id"),
});

export type CreateGeneralLeadInput = z.infer<typeof createGeneralLeadSchema>;
export type CreateOrganizationInquiryInput = z.infer<typeof createOrganizationInquirySchema>;
export type CreateSiteVisitInput = z.infer<typeof createSiteVisitSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type AssignInput = z.infer<typeof assignSchema>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
export type ListLeadInquiriesQueryInput = z.infer<typeof listLeadInquiriesQuerySchema>;
export type LeadInquiryIdParams = z.infer<typeof leadInquiryIdParamsSchema>;
