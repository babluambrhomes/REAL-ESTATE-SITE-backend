import { z } from "zod";

export const updateUserSchema = z.object({
  firstName: z.string().min(1).trim().optional(),
  lastName: z.string().trim().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string().optional(),
  addressLine: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
