import { z } from "zod";

export const toggleWishlistParamsSchema = z.object({
  id: z.string().uuid("Invalid property id"),
});

export const wishlistQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});

export type ToggleWishlistParams = z.infer<typeof toggleWishlistParamsSchema>;
export type WishlistQueryInput = z.infer<typeof wishlistQuerySchema>;
