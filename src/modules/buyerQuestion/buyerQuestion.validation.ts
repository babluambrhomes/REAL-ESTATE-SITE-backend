import { z } from "zod";

export const buyerQuestionStatuses = ["PENDING", "ANSWERED", "CLOSED"] as const;

export type BuyerQuestionStatusValue = (typeof buyerQuestionStatuses)[number];

export const createBuyerQuestionSchema = z.object({
  // Sawal hamesha ek seller ko jata hai
  sellerId: z.string().uuid("Invalid seller"),
  // Property page se poocha ho to set hoga — seller profile se poochne par optional
  propertyId: z.string().uuid("Invalid property").optional(),
  question: z
    .string()
    .min(10, "Question must be at least 10 characters")
    .max(1000, "Question must be under 1000 characters")
    .trim(),
});

// Buyer sirf apna sawal edit kar sakta hai (PENDING status me)
export const updateBuyerQuestionSchema = z.object({
  question: z
    .string()
    .min(10, "Question must be at least 10 characters")
    .max(1000, "Question must be under 1000 characters")
    .trim(),
});

export const answerBuyerQuestionSchema = z.object({
  answer: z
    .string()
    .min(1, "Answer is required")
    .max(5000, "Answer must be under 5000 characters")
    .trim(),
});

export const updateBuyerQuestionStatusSchema = z.object({
  status: z.enum(buyerQuestionStatuses),
});

export const listBuyerQuestionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(buyerQuestionStatuses).optional(),
  propertyId: z.string().uuid("Invalid property").optional(),
});

export const buyerQuestionIdParamsSchema = z.object({
  id: z.string().uuid("Invalid question id"),
});

export type CreateBuyerQuestionInput = z.infer<typeof createBuyerQuestionSchema>;
export type UpdateBuyerQuestionInput = z.infer<typeof updateBuyerQuestionSchema>;
export type AnswerBuyerQuestionInput = z.infer<typeof answerBuyerQuestionSchema>;
export type UpdateBuyerQuestionStatusInput = z.infer<typeof updateBuyerQuestionStatusSchema>;
export type ListBuyerQuestionsQueryInput = z.infer<typeof listBuyerQuestionsQuerySchema>;
export type BuyerQuestionIdParams = z.infer<typeof buyerQuestionIdParamsSchema>;