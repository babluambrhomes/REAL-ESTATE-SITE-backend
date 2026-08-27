import { Router } from "express";
import {
  register,
  login,
  publicOtpVerify,
  privateOtpVerify,
  addContact,
  updatePassword,
  refreshToken,
  logout,
  forgotPasswordRequest,
  resetPassword,
} from "./auth.controller";
import { protect, validate, authRateLimit, otpRateLimit } from "../../middlewares";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  confirmOtpSchema,
  refreshTokenSchema,
  forgotPasswordRequestSchema,
  resetPasswordSchema,
  addContactSchema,
  updatePasswordSchema,
} from "./auth.validation";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", authRateLimit, validate(loginSchema), login);
router.post("/public-otp-verify", otpRateLimit, validate(verifyOtpSchema), publicOtpVerify);
router.post("/private-otp-verify", protect, otpRateLimit, validate(confirmOtpSchema), privateOtpVerify);
router.post("/refresh", validate(refreshTokenSchema), refreshToken);
router.post("/forgot-password", otpRateLimit, validate(forgotPasswordRequestSchema), forgotPasswordRequest);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.patch("/me/contact", protect, validate(addContactSchema), addContact);
router.patch("/me/password", protect, validate(updatePasswordSchema), updatePassword);
router.post("/logout", protect, logout);

export default router;
