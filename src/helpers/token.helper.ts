import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../config/prisma";
import { TokenStatus } from "../generated/prisma/enums";
import { ApiError } from "../utils";

const generateAccessToken = (userId: string): string => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  } as jwt.SignOptions);
};

const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || "15d",
  } as jwt.SignOptions);
};

const generateTokenPair = (userId: string) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);
  return { accessToken, refreshToken };
};


const JWT_SECRET = process.env.JWT_SECRET;

// ✅ Validate secret exists at startup
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

 const verifyAccessToken = (token: string): { id: string } => {
  try {
    let cleanToken = token;
    cleanToken = cleanToken.trim();
    cleanToken = cleanToken.replace(/^["']|["']$/g, '');
    cleanToken = cleanToken.replace(/\n/g, '');
    if (!cleanToken || cleanToken.length === 0) {
      throw new ApiError(401, 'Token is empty');
    }
    const parts = cleanToken.split('.');
    if (parts.length !== 3) {
      console.error('Invalid token parts:', parts.length);
      throw new ApiError(401, 'Invalid token format');
    }
    if (!parts[0] || !parts[1] || !parts[2]) {
      console.error('Token has empty parts');
      throw new ApiError(401, 'Malformed token');
    }
  
    const decoded = jwt.verify(cleanToken, JWT_SECRET, {
      algorithms: ['HS256'],  
    });
    
    if (!decoded || typeof decoded !== 'object' || !('id' in decoded)) {
      console.error('Token missing id field');
      throw new ApiError(401, 'Invalid token payload');
    }
    
    return decoded as { id: string };
    
  } catch (error: any) {
    console.error('JWT Verification Error:', {
      name: error.name,
      message: error.message,
      tokenPreview: token?.substring(0, 20) + '...'
    });
    
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      if (error.message.includes('malformed')) {
        throw new ApiError(401, 'Malformed token. Please login again.');
      }
      if (error.message.includes('signature')) {
        throw new ApiError(401, 'Invalid token signature. Token may be tampered.');
      }
      if (error.message.includes('invalid algorithm')) {
        throw new ApiError(401, 'Invalid token algorithm.');
      }
      throw new ApiError(401, 'Invalid token');
    }
    
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token has expired. Please login again.');
    }
    
    if (error.name === 'NotBeforeError') {
      throw new ApiError(401, 'Token is not active yet.');
    }
  
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Unknown error
    throw new ApiError(401, 'Authentication failed');
  }
};

const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as { id: string };
};

const storeRefreshToken = async (
  userId: string,
  token: string,
  userAgent?: string,
  ipAddress?: string
) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return prisma.refreshToken.create({
    data: {
      userId,
      token,
      status: TokenStatus.ACTIVE,
      family: crypto.randomUUID(),
      userAgent,
      ipAddress,
      expiresAt,
    },
  });
};

const revokeRefreshToken = async (token: string) => {
  return prisma.refreshToken.updateMany({
    where: { token },
    data: { status: TokenStatus.REVOKED },
  });
};

const revokeAllUserTokens = async (userId: string) => {
  return prisma.refreshToken.updateMany({
    where: { userId, status: TokenStatus.ACTIVE },
    data: { status: TokenStatus.REVOKED },
  });
};

const isRefreshTokenValid = async (token: string) => {
  const stored = await prisma.refreshToken.findUnique({
    where: { token },
  });

  if (!stored) return false;
  if (stored.status !== TokenStatus.ACTIVE) return false;
  if (new Date() > stored.expiresAt) return false;

  return true;
};

const getAccessCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 15 * 60 * 1000, // 15 minutes
});

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

const generatePurposeToken = (userId: string, purpose: string, expiresIn?: string): string => {
  return jwt.sign(
    { id: userId, purpose },
    process.env.JWT_SECRET as string,
    { expiresIn: expiresIn || "15m" } as jwt.SignOptions
  );
};

const verifyPurposeToken = (token: string, expectedPurpose: string): { id: string; purpose: string } => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
      purpose: string;
    };

    if (decoded.purpose !== expectedPurpose) {
      throw new ApiError(400, "Invalid token");
    }

    return decoded;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Invalid or expired token");
  }
};

export {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  isRefreshTokenValid,
  getAccessCookieOptions,
  getRefreshCookieOptions,
  generatePurposeToken,
  verifyPurposeToken,
};
