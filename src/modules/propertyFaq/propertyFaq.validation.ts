import { z } from "zod";

export const createFaqSchema = z.object({
  propertyId: z.string().uuid("Invalid property"),
  question: z.string().min(1, "Question is required").max(500).trim(),
  answer: z.string().min(1, "Answer is required").max(5000).trim(),
  // Na bheja ho to service khud next order assign karega
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateFaqSchema = z.object({
  question: z.string().min(1, "Question is required").max(500).trim().optional(),
  answer: z.string().min(1, "Answer is required").max(5000).trim().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// Poore property ka order ek saath update karne ke liye
export const reorderFaqsSchema = z.object({
  propertyId: z.string().uuid("Invalid property"),
  faqs: z
    .array(
      z.object({
        id: z.string().uuid("Invalid FAQ"),
        displayOrder: z.number().int().min(0),
      })
    )
    .min(1, "At least one FAQ is required")
    .max(200, "Too many FAQs in one request"),
});

export const listFaqsQuerySchema = z.object({
  propertyId: z.string().uuid("Invalid property"),
});

export const faqIdParamsSchema = z.object({
  id: z.string().uuid("Invalid FAQ"),
});

export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;
export type ReorderFaqsInput = z.infer<typeof reorderFaqsSchema>;
export type ListFaqsQueryInput = z.infer<typeof listFaqsQuerySchema>;
