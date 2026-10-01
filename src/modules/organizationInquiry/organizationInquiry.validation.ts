import { z } from "zod";

/**
 * Reused from LeadForm on purpose.
 *
 * These lists are not re-declared so that a status filter typed against
 * lead_forms means the same thing here. If someone later adds a lead status
 * and forgets this module, the org inbox silently reports an unknown value
 * instead of failing at the catalogue the way an enum mismatch should.
 */
export const inquiryStatuses = [
  "NEW",
  "CONTACTED",
  "SITE_VISIT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export const inquirySources = [
  "ENQUIRY_FORM",
  "WHATSAPP",
  "CALL_NOW",
  "REQUEST_CALL_BACK",
  "CONTACT",
] as const;

/**
 * Consent is enforced here rather than defaulted.
 *
 * The column has a DB-level `false` default as a backstop, but a schema that
 * accepted `undefined` would let a request through and store a row claiming
 * the user agreed to terms they never saw. The form's terms can change, so
 * the row records when consent was given.
 */
const termsAcceptedLiteral = z.literal(true, {
  error: "You must agree to the Terms & Conditions",
});

/**
 * name/phone are optional in the request because login is required — they
 * fall back to the user's profile (LeadForm does the same). The service
 * rejects the write if neither the body nor the profile can supply them.
 */
export const createInquirySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200).trim().optional(),
  email: z.string().email("Enter a valid email").trim().toLowerCase().optional(),
  phone: z.string().min(6, "Phone must be at least 6 characters").max(20).trim().optional(),

  /** Free text as the buyer typed it — "50L - 1Cr", "1 Crore se ooper". */
  budgetRange: z
    .string()
    .max(200, "Budget must be at most 200 characters")
    .trim()
    .optional(),

  preferredProject: z
    .string()
    .max(300, "Preferred project must be at most 300 characters")
    .trim()
    .optional(),

  message: z.string().max(2000, "Message must be at most 2000 characters").trim().optional(),

  termsAccepted: termsAcceptedLiteral,
});

export const updateInquiryStatusSchema = z.object({
  status: z.enum(inquiryStatuses),
});

export const updateInquiryCommentSchema = z.object({
  comment: z.string().min(1, "Comment is required").max(5000).trim(),
});

/**
 * Assigning an inquiry to a member.
 *
 * The service checks the member belongs to THIS org — the id alone is not
 * enough, since a valid member of another company would otherwise be
 * assignable and would then be able to read the inquiry.
 */
export const assignInquirySchema = z.object({
  memberId: z.string().uuid("Invalid member").nullable(),
});

export const listInquiriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(inquiryStatuses).optional(),
  source: z.enum(inquirySources).optional(),
  assignedToMemberId: z.string().uuid("Invalid member").optional(),
});

export const orgIdParamsSchema = z.object({
  orgId: z.string().uuid("Invalid organization"),
});

export const inquiryParamsSchema = z.object({
  orgId: z.string().uuid("Invalid organization"),
  id: z.string().uuid("Invalid inquiry"),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
export type UpdateInquiryStatusInput = z.infer<typeof updateInquiryStatusSchema>;
export type UpdateInquiryCommentInput = z.infer<typeof updateInquiryCommentSchema>;
export type AssignInquiryInput = z.infer<typeof assignInquirySchema>;
export type ListInquiriesQueryInput = z.infer<typeof listInquiriesQuerySchema>;
