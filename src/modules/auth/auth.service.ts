import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import {
  RegisterInput,
  LoginInput,
  VerifyOtpInput,
  ForgotPasswordRequestInput,
  ResetPasswordInput,
  AddContactInput,
  UpdatePasswordInput,
} from "./auth.validation";
import {
  hashPassword,
  comparePassword,
  createOtp,
  verifyOtp as verifyOtpHelper,
  generateResetToken,
  verifyResetToken,
  generateTokenPair,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  isRefreshTokenValid,
  verifyRefreshToken,
} from "../../helpers";
import { OtpPurpose } from "../../generated/prisma/enums";
import { userSelect } from "../../middlewares/auth.middleware";
import emailQueue from "../../queues/email.queue";
import smsQueue from "../../queues/sms.queue";
import { otpVerificationTemplate } from "../../emails/templates/otp-verification";
import { welcomeTemplate } from "../../emails/templates/welcome";
import { passwordResetLinkTemplate } from "../../emails/templates/password-reset";
import { firebaseAuth } from "../../config/firebase";

const generateTokens = async (
  user: { id: string; email: string | null; phone: string | null; status: string; emailVerified: boolean; phoneVerified: boolean; createdAt: Date; updatedAt: Date },
  userAgent?: string,
  ipAddress?: string
) => {
  const { accessToken, refreshToken } = generateTokenPair(user.id);
  await storeRefreshToken(user.id, refreshToken, userAgent, ipAddress);

  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    accessToken,
    refreshToken,
  };
};

const register = async (data: RegisterInput, userAgent?: string, ipAddress?: string) => {
  const { email, phone, password, accessToken, firstName } = data;

  // --- Google Registration ---
  if (accessToken) {
    let decoded;
    try {
      decoded = await firebaseAuth.verifyIdToken(accessToken);
    } catch {
      throw new ApiError(401, "Invalid or expired Google token");
    }

    const googleEmail = decoded.email;
    if (!googleEmail) throw new ApiError(400, "Email not available from Google account");
    const googleId = decoded.uid;
    const googleName = decoded.name || null;
    const googlePhoto = decoded.picture || null;

    const existingByGoogle = await prisma.user.findUnique({ where: { googleId } });
    if (existingByGoogle) {
      if (existingByGoogle.status === "SUSPENDED" || existingByGoogle.status === "DEACTIVATED") {
        throw new ApiError(403, "Account is not accessible");
      }
      return generateTokens(existingByGoogle, userAgent, ipAddress);
    }

    const existingByEmail = await prisma.user.findUnique({ where: { email: googleEmail } });
    if (existingByEmail) {
      const updated = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { googleId, emailVerified: true },
        select: userSelect,
      });
      return generateTokens(updated, userAgent, ipAddress);
    }

    const newUser = await prisma.user.create({
      data: {
        email: googleEmail,
        googleId,
        hasPassword: "GOOGLE_AUTH",
        status: "ACTIVE",
        emailVerified: true,
        accountOrigin: "SELF_REGISTERED",
      },
      select: userSelect,
    });

    // Firebase displayName se first/last name, photoURL se avatar
    let firstName = googleEmail.split("@")[0];
    let lastName = "";
    if (googleName) {
      const nameParts = googleName.trim().split(/\s+/);
      firstName = nameParts[0] || firstName;
      lastName = nameParts.slice(1).join(" ") || "";
    }

    await prisma.$transaction(async (tx) => {
      await tx.person.create({
        data: {
          userId: newUser.id,
          firstName,
          lastName,
          ...(googlePhoto ? { avatarUrl: googlePhoto } : {}),
        },
      });
      await tx.buyerProfile.create({ data: { userId: newUser.id, isActive: true } });
    });

    return generateTokens(newUser, userAgent, ipAddress);
  }

  // --- Email + Password Registration ---
  if (email && password) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.status === "ACTIVE") throw new ApiError(409, "User already exists with this email");
      if (existing.status === "SUSPENDED" || existing.status === "DEACTIVATED") throw new ApiError(403, "Account is not accessible");

      const hashedPassword = await hashPassword(password);
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { hasPassword: hashedPassword },
        select: userSelect,
      });

      const otp = await createOtp({ userId: updated.id, identifier: email, purpose: "EMAIL_VERIFICATION" as OtpPurpose });
      const template = otpVerificationTemplate({ code: otp.plainCode, userName: email });
      emailQueue.add("send-otp-email", { to: email, subject: template.subject, html: template.html });

      return generateTokens(updated, userAgent, ipAddress);
    }

    const hashedPassword = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        email,
        hasPassword: hashedPassword,
        status: "PENDING",
        accountOrigin: "SELF_REGISTERED",
      },
      select: userSelect,
    });

    const otp = await createOtp({ userId: newUser.id, identifier: email, purpose: "EMAIL_VERIFICATION" as OtpPurpose });
    const template = otpVerificationTemplate({ code: otp.plainCode, userName: email });
    emailQueue.add("send-otp-email", { to: email, subject: template.subject, html: template.html });

    if (firstName) {
      await prisma.$transaction(async (tx) => {
        await tx.person.create({ data: { userId: newUser.id, firstName, lastName: "" } });
        await tx.buyerProfile.create({ data: { userId: newUser.id, isActive: true } });
      });
    }

    return generateTokens(newUser, userAgent, ipAddress);
  }

  // --- Phone Only Registration ---
  if (phone) {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      if (existing.status === "ACTIVE") throw new ApiError(409, "User already exists with this phone number");
      if (existing.status === "SUSPENDED" || existing.status === "DEACTIVATED") throw new ApiError(403, "Account is not accessible");

      const otp = await createOtp({ userId: existing.id, identifier: phone, purpose: "PHONE_VERIFICATION" as OtpPurpose });

      console.log(`OTP for phone ${phone}: ${otp.plainCode}`); // Log the OTP for testing purposes
      // smsQueue.add("send-phone-otp", { to: phone, message: `Your AmbrHomes verification code is: ${otp.plainCode}. Valid for 10 minutes.` });

      return generateTokens(existing, userAgent, ipAddress);
    }

    const newUser = await prisma.user.create({
      data: { phone, status: "PENDING", accountOrigin: "SELF_REGISTERED" },
      select: userSelect,
    });

    const otp = await createOtp({ userId: newUser.id, identifier: phone, purpose: "PHONE_VERIFICATION" as OtpPurpose });
    smsQueue.add("send-phone-otp", { to: phone, message: `Your AmbrHomes verification code is: ${otp.plainCode}. Valid for 10 minutes.` });

    if (firstName) {
      await prisma.$transaction(async (tx) => {
        await tx.person.create({ data: { userId: newUser.id, firstName, lastName: "" } });
        await tx.buyerProfile.create({ data: { userId: newUser.id, isActive: true } });
      });
    }

    return generateTokens(newUser, userAgent, ipAddress);
  }

  throw new ApiError(400, "Invalid registration data");
};

const login = async (data: LoginInput, userAgent?: string, ipAddress?: string) => {
  const { email, phone, password, code, accessToken } = data;

  // --- Google Login ---
  if (accessToken) {
    let decoded;
    try {
      decoded = await firebaseAuth.verifyIdToken(accessToken);
    } catch {
      throw new ApiError(401, "Invalid or expired Google token");
    }

    const googleEmail = decoded.email;
    if (!googleEmail) throw new ApiError(400, "Email not available from Google account");

    let user = await prisma.user.findUnique({ where: { email: googleEmail } });
    if (!user) throw new ApiError(404, "No account found. Please register first.");

    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: decoded.uid, emailVerified: true },
      });
    }

    if (user.status === "SUSPENDED") throw new ApiError(403, "Account has been suspended");
    if (user.status === "DEACTIVATED") throw new ApiError(403, "Account has been deactivated");
    if (user.status === "PENDING") throw new ApiError(403, "Please verify your account to continue");

    return generateTokens(user, userAgent, ipAddress);
  }

  // --- Email + Password Login ---
  if (email && password) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(401, "Invalid email or password");
    if (user.status === "SUSPENDED") throw new ApiError(403, "Account has been suspended");
    if (user.status === "DEACTIVATED") throw new ApiError(403, "Account has been deactivated");
    if (user.status === "PENDING") throw new ApiError(403, "Please verify your email to continue");
    if (!user.hasPassword || user.hasPassword === "GOOGLE_AUTH") throw new ApiError(401, "Please login using Google");

    const isMatch = await comparePassword(password, user.hasPassword);
    if (!isMatch) throw new ApiError(401, "Invalid email or password");

    return generateTokens(user, userAgent, ipAddress);
  }

  // --- Phone Login ---
  if (phone) {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) throw new ApiError(404, "No account found with this phone number");
    if (user.status === "SUSPENDED") throw new ApiError(403, "Account has been suspended");
    if (user.status === "DEACTIVATED") throw new ApiError(403, "Account has been deactivated");
    if (user.status === "PENDING") throw new ApiError(403, "Please verify your phone to continue");

    if (!code) {
      const otp = await createOtp({ userId: user.id, identifier: phone, purpose: "LOGIN_PASSWORDLESS" as OtpPurpose });
      smsQueue.add("send-phone-otp", { to: phone, message: `Your AmbrHomes login code is: ${otp.plainCode}. Valid for 10 minutes.` });
      return { message: "OTP sent to your phone", requiresOtp: true };
    }

    const result = await verifyOtpHelper({ identifier: phone, code, purpose: "LOGIN_PASSWORDLESS" as OtpPurpose });
    if (!result.valid) throw new ApiError(400, result.message);

    return generateTokens(user, userAgent, ipAddress);
  }

  throw new ApiError(400, "Invalid login credentials");
};

const verifyOtp = async (data: VerifyOtpInput, userAgent?: string, ipAddress?: string) => {
  const { identifier, code, purpose } = data;

  const result = await verifyOtpHelper({ identifier, code, purpose: purpose as OtpPurpose });
  if (!result.valid) throw new ApiError(400, result.message);

  if (purpose === "EMAIL_VERIFICATION") {
    const user = await prisma.user.findFirst({ where: { email: identifier } });
    if (!user) throw new ApiError(404, "User not found");

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    const tokens = await generateTokens(updatedUser, userAgent, ipAddress);
    return { message: "Email verified successfully", ...tokens };
  }

  if (purpose === "PHONE_VERIFICATION") {
    const user = await prisma.user.findFirst({ where: { phone: identifier } });
    if (!user) throw new ApiError(404, "User not found");

    const updateData: any = { phoneVerified: true };
    if (user.status === "PENDING") {
      updateData.status = "ACTIVE";
    }
    const updatedUser = await prisma.user.update({ where: { id: user.id }, data: updateData });

    if (updateData.status === "ACTIVE" && user.email) {
      const person = await prisma.person.findUnique({ where: { userId: user.id }, select: { firstName: true } });
      const userName = person?.firstName || user.email?.split("@")[0] || "User";
      const welcomeHtml = welcomeTemplate({ userName });
      await emailQueue.add("send-welcome-email", { to: user.email!, subject: welcomeHtml.subject, html: welcomeHtml.html });
    }

    const tokens = await generateTokens(updatedUser, userAgent, ipAddress);
    return { message: "Phone verified successfully", ...tokens };
  }

  return { message: "OTP verified successfully" };
};

const addContact = async (userId: string, data: AddContactInput) => {
  const { email, phone } = data;

  if (phone) {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== userId) {
      throw new ApiError(409, "Phone number already in use");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerified: false },
    });

    const otp = await createOtp({ userId, identifier: phone, purpose: "PHONE_VERIFICATION" as OtpPurpose });
    console.log('otp.plainCode', otp.plainCode)
    smsQueue.add("send-phone-otp", { to: phone, message: `Your AmbrHomes verification code is: ${otp.plainCode}. Valid for 10 minutes.` });
  }

  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      throw new ApiError(409, "Email already in use");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { email, emailVerified: false },
    });

    const otp = await createOtp({ userId, identifier: email, purpose: "EMAIL_VERIFICATION" as OtpPurpose });

     console.log('otp.plainCode', otp.plainCode)
    const template = otpVerificationTemplate({ code: otp.plainCode, userName: email.split("@")[0] });
    emailQueue.add("send-otp-email", { to: email, subject: template.subject, html: template.html });
  }

  return { message: `OTP sent to your ${email ? "email" : "phone"}` };
};

const refreshAccessToken = async (refreshToken: string) => {
  const isValid = await isRefreshTokenValid(refreshToken);
  if (!isValid) throw new ApiError(401, "Invalid or expired refresh token");

  const decoded = verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, status: true },
  });

  if (!user || user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
    throw new ApiError(401, "User not found or inaccessible");
  }

  await revokeRefreshToken(refreshToken);

  const tokens = generateTokenPair(user.id);
  await storeRefreshToken(user.id, tokens.refreshToken);

  return tokens;
};

const logout = async (refreshToken?: string) => {
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
};

const logoutAll = async (userId: string) => {
  await revokeAllUserTokens(userId);
};

const forgotPasswordRequest = async (data: ForgotPasswordRequestInput) => {
  const { email } = data;

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.status === "ACTIVE" && user.hasPassword && user.hasPassword !== "GOOGLE_AUTH") {
    const resetToken = generateResetToken(user.id);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const resetLink = `${clientUrl}/reset-password?token=${resetToken}`;

    const person = await prisma.person.findUnique({ where: { userId: user.id }, select: { firstName: true } });
    const userName = person?.firstName || email.split("@")[0];
    const template = passwordResetLinkTemplate({ link: resetLink, userName });

    await emailQueue.add("send-reset-email", { to: email, subject: template.subject, html: template.html });
  }

  return { message: "If an account with this email exists, a reset link has been sent." };
};

const resetPassword = async (data: ResetPasswordInput) => {
  const { token, newPassword } = data;

  const decoded = verifyResetToken(token);

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user) throw new ApiError(404, "User not found");

  const hashedPassword = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { hasPassword: hashedPassword } });
    await tx.refreshToken.updateMany({ where: { userId: user.id, status: "ACTIVE" }, data: { status: "REVOKED" } });
  });

  return { message: "Password reset successful. Please login with your new password." };
};

const updatePassword = async (userId: string, data: UpdatePasswordInput) => {
  const { currentPassword, newPassword } = data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");
  if (!user.emailVerified) throw new ApiError(400, "Please verify your email first");
  if (!user.hasPassword || user.hasPassword === "GOOGLE_AUTH") throw new ApiError(400, "No password set for this account");

  const isMatch = await comparePassword(currentPassword, user.hasPassword);
  if (!isMatch) throw new ApiError(400, "Current password is incorrect");

  const hashedPassword = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { hasPassword: hashedPassword } });
    await tx.refreshToken.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "REVOKED" } });
  });

  return { message: "Password updated successfully. Please login again." };
};

export {
  register,
  login,
  verifyOtp,
  addContact,
  updatePassword,
  refreshAccessToken,
  logout,
  logoutAll,
  forgotPasswordRequest,
  resetPassword,
};
