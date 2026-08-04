import crypto from "crypto";
import prisma from "../config/prisma";
import { OtpPurpose, OtpStatus } from "../generated/prisma/enums";


const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const OTP_HASH_SECRET = process.env.OTP_HASH_SECRET || "default-otp-secret-change-me";

const generateOtpCode = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

const hashOtp = (code: string): string => {
  return crypto.createHmac("sha256", OTP_HASH_SECRET).update(code).digest("hex");
};

const createOtp = async (params: {
  userId?: string;
  identifier: string;
  purpose: OtpPurpose;
}) => {
  const code = generateOtpCode();
  const hashedCode = hashOtp(code);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

  // Invalidate any existing ACTIVE OTPs for same identifier + purpose
  await prisma.otp.updateMany({
    where: {
      identifier: params.identifier,
      purpose: params.purpose,
      status: OtpStatus.ACTIVE,
    },
    data: { status: OtpStatus.EXPIRED },
  });

  const otp = await prisma.otp.create({
    data: {
      userId: params.userId,
      identifier: params.identifier,
      code: hashedCode,
      purpose: params.purpose,
      status: OtpStatus.ACTIVE,
      maxAttempts: MAX_OTP_ATTEMPTS,
      expiresAt,
    },
  });

  // Return OTP with plain code (for sending via email/SMS)
  return { ...otp, plainCode: code };
};

const verifyOtp = async (params: {
  identifier: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<{ valid: boolean; message: string }> => {
  const otp = await prisma.otp.findFirst({
    where: {
      identifier: params.identifier,
      purpose: params.purpose,
      status: OtpStatus.ACTIVE,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { valid: false, message: "OTP not found" };
  }

  if (new Date() > otp.expiresAt) {
    await prisma.otp.update({
      where: { id: otp.id },
      data: { status: OtpStatus.EXPIRED },
    });
    return { valid: false, message: "OTP has expired" };
  }

  if (otp.attempts >= otp.maxAttempts) {
    await prisma.otp.update({
      where: { id: otp.id },
      data: { status: OtpStatus.EXPIRED },
    });
    return { valid: false, message: "OTP max attempts exceeded" };
  }

  const hashedInput = hashOtp(params.code);

  if (otp.code !== hashedInput) {
    await prisma.otp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { valid: false, message: "Invalid OTP" };
  }

  // Mark OTP as used
  await prisma.otp.update({
    where: { id: otp.id },
    data: {
      status: OtpStatus.USED,
      verifiedAt: new Date(),
    },
  });

  return { valid: true, message: "OTP verified successfully" };
};

const isOtpExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt;
};

export { createOtp, verifyOtp, isOtpExpired, generateOtpCode };
