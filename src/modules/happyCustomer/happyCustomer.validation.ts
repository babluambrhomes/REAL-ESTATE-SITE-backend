import { z } from "zod";

export const createHappyCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(5000),
  rating: z
    .number()
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  photoUrl: z.string().trim().max(2000).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  userId: z.string().uuid("Invalid user").nullable().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateHappyCustomerSchema = createHappyCustomerSchema.partial();

export const happyCustomerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});

export const happyCustomerIdParamsSchema = z.object({
  id: z.string().uuid("Invalid happy customer id"),
});

export type CreateHappyCustomerInput = z.infer<typeof createHappyCustomerSchema>;
export type UpdateHappyCustomerInput = z.infer<typeof updateHappyCustomerSchema>;
export type HappyCustomerListQueryInput = z.infer<
  typeof happyCustomerListQuerySchema
>;
