import { z } from "zod";
import { propertyTypes, transactionTypes } from "../property/property.validation";

const comparePropertyItemSchema = z.object({
  propertyId: z.string().uuid("Invalid property id"),
  variantId: z.string().uuid("Invalid variant id"),
});

export const comparePropertiesSchema = z.object({
  properties: z
    .array(comparePropertyItemSchema)
    .min(1, "At least one property is required")
    .max(5, "Maximum 5 properties allowed"),
});

export const suggestPropertiesQuerySchema = z
  .object({
    city: z.string().trim().max(100).optional(),
    propertyType: z.enum(propertyTypes).optional(),
    transactionType: z.enum(transactionTypes).optional(),
    bedrooms: z.coerce.number().int().min(0).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
  })
  .refine(
    (data) =>
      data.minPrice === undefined ||
      data.maxPrice === undefined ||
      data.minPrice <= data.maxPrice,
    { message: "minPrice must be less than or equal to maxPrice" }
  );

export type ComparePropertiesInput = z.infer<typeof comparePropertiesSchema>;
export type SuggestPropertiesQueryInput = z.infer<
  typeof suggestPropertiesQuerySchema
>;
