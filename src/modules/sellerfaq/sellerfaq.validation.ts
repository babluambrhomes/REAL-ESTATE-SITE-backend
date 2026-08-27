import { z } from "zod";

export const createFaqSchema = z.object({
  question: z.string().min(1, "Question is required").max(500).trim(),
  answer: z.string().min(1, "Answer is required").max(5000).trim(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateFaqSchema = createFaqSchema.partial();

export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;
