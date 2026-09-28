import { z } from "zod";

export const siteVisitStatuses = [
  "PENDING",
  "CONFIRMED",
  "RESCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type SiteVisitStatusValue = (typeof siteVisitStatuses)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

// "2026-01-15" ya "2026-01-15T10:30:00.000Z" dono format
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

// Date string → Date (UTC midnight for plain dates)
const toDate = (v: string): Date =>
  ISO_DATE.test(v) ? new Date(`${v}T00:00:00.000Z`) : new Date(v.replace(" ", "T"));

// Visit time fields shared by booking aur reschedule (raw strings, transform baad me)
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

// Visit time ke do validations: endTime ordering aur future time check
const endTimeAfterStart = (d: { startTime: string; endTime?: string }) =>
  !d.endTime || new Date(d.endTime) > new Date(d.startTime);

const startTimeInFuture = (d: { startTime: string }) => new Date(d.startTime) > new Date();

export const bookSiteVisitSchema = z
  .object({
    sellerId: z.string().uuid("Invalid seller").optional(),
    organizationId: z.string().uuid("Invalid organization").optional(),
    propertyId: z.string().uuid("Invalid property").optional(),
    name: z.string().min(2, "Name is required").max(200).trim().optional(),
    email: z.string().email("Enter a valid email").trim().toLowerCase().optional(),
    phone: z.string().min(6, "Phone is required").max(20).trim().optional(),
    message: z.string().max(2000).trim().optional(),
    // Buyer ka address — fully optional, buyer de bhi sakta hai na bhi
    userAddress: z.string().max(500).trim().optional(),
    ...visitTimeShape,
  })
  .refine((data) => Boolean(data.sellerId || data.organizationId || data.propertyId), {
    message: "sellerId, organizationId or propertyId is required",
    path: ["sellerId"],
  })
  .refine(endTimeAfterStart, { message: "endTime must be after startTime", path: ["endTime"] })
  .refine(startTimeInFuture, { message: "Visit time must be in the future", path: ["startTime"] })
  .transform(toVisitDates);

export const rescheduleSiteVisitSchema = z
  .object({
    ...visitTimeShape,
    comment: z.string().max(5000).trim().optional(),
  })
  .refine(endTimeAfterStart, { message: "endTime must be after startTime", path: ["endTime"] })
  .refine(startTimeInFuture, { message: "Visit time must be in the future", path: ["startTime"] })
  .transform(toVisitDates);

export const updateSiteVisitStatusSchema = z.object({
  status: z.enum(siteVisitStatuses),
  comment: z.string().max(5000).trim().optional(),
});

export const updateSiteVisitCommentSchema = z.object({
  comment: z.string().min(1, "Comment is required").max(5000).trim(),
});

// Buyer sirf cancel kar sakta hai — confirm/complete seller ka kaam hai
export const cancelSiteVisitSchema = z.object({
  reason: z.string().max(2000).trim().optional(),
});

export const listSiteVisitsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    status: z.enum(siteVisitStatuses).optional(),
    propertyId: z.string().uuid("Invalid property").optional(),
    sellerId: z.string().uuid("Invalid seller").optional(),
    organizationId: z.string().uuid("Invalid organization").optional(),
    from: isoDateTimeString.optional(),
    to: isoDateTimeString.optional(),
    // query string me "false" bhi aata hai — z.coerce.boolean() usse true bana deta hai
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

export const siteVisitIdParamsSchema = z.object({
  id: z.string().uuid("Invalid site visit id"),
});

export type BookSiteVisitInput = z.infer<typeof bookSiteVisitSchema>;
export type RescheduleSiteVisitInput = z.infer<typeof rescheduleSiteVisitSchema>;
export type UpdateSiteVisitStatusInput = z.infer<typeof updateSiteVisitStatusSchema>;
export type UpdateSiteVisitCommentInput = z.infer<typeof updateSiteVisitCommentSchema>;
export type CancelSiteVisitInput = z.infer<typeof cancelSiteVisitSchema>;
export type ListSiteVisitsQueryInput = z.infer<typeof listSiteVisitsQuerySchema>;
export type SiteVisitIdParams = z.infer<typeof siteVisitIdParamsSchema>;
