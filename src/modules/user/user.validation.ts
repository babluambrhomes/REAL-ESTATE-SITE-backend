import { z } from "zod";

export const updateUserSchema = z.object({});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
