import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Enter a valid email").toLowerCase().trim().optional(),
  phone: z.string().min(10, "Enter a valid phone number").max(15, "Enter a valid phone number").trim().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").max(60).optional(),
  accessToken: z.string().optional(),
  firstName: z.string().min(1, "Enter your first name").trim().optional(),
  lastName: z.string().trim().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
}).refine(
  (d) => d.email || d.phone || d.accessToken,
  { message: "Email, phone, or Google account is required" }
).refine(
  (d) => {
    if (d.email && !d.accessToken) return !!d.password;
    return true;
  },
  { message: "Password is required for email registration" }
);

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email").toLowerCase().trim().optional(),
  phone: z.string().min(10).max(15).trim().optional(),
  password: z.string().optional(),
  code: z.string().length(6, "OTP must be 6 digits").optional(),
  accessToken: z.string().optional(),
}).refine(
  (d) => {
    if (d.email && d.password) return true;
    if (d.accessToken) return true;
    if (d.phone) return true;
    return false;
  },
  { message: "Provide (email+password), (phone), (phone+code), or (accessToken)" }
);

export const verifyOtpSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  code: z.string().length(6, "OTP must be 6 digits"),
  purpose: z.enum([
    "EMAIL_VERIFICATION",
    "PHONE_VERIFICATION",
    "PASSWORD_RESET",
    "LOGIN_2FA",
    "LOGIN_PASSWORDLESS",
    "ACCOUNT_DELETION",
  ]),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email("Enter a valid email").toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(60),
});

export const addContactSchema = z.object({
  email: z.string().email("Enter a valid email").toLowerCase().trim().optional(),
  phone: z.string().min(10, "Enter a valid phone number").max(15, "Enter a valid phone number").trim().optional(),
}).refine((d) => d.email || d.phone, { message: "Email or phone is required" });

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(60),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AddContactInput = z.infer<typeof addContactSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
