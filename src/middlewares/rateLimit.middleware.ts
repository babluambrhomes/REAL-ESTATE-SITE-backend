import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils";
import { AuthRequest } from "../types";
import redisConnection from "../config/redis";

const rateLimit = (options: {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
  keyBy?: (req: Request) => string;
}) => {
  const {
    windowMs = 15 * 60 * 1000,
    maxRequests = 100,
    message = "Too many requests, please try again later",
    keyBy = (req) => req.ip || "unknown",
  } = options;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const key = `rateLimit:${keyBy(req)}`;

    const count = await redisConnection.incr(key);

    if (count === 1) {
      await redisConnection.expire(key, windowSeconds);
    }

    if (count > maxRequests) {
      const ttl = await redisConnection.ttl(key);
      _res.setHeader("Retry-After", ttl > 0 ? ttl : windowSeconds);
      throw new ApiError(429, message);
    }

    next();
  };
};

// Preset: auth routes (strict)
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Too many authentication attempts, please try again after 15 minutes",
});

// Preset: API routes (normal)
const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  maxRequests: 60,
  message: "Too many API requests, please try again later",
});

// Preset: OTP routes (very strict)
const otpRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  maxRequests: 20,
  message: "Too many OTP requests, please try again after 5 minutes",
});

// Preset: buyer → seller sawaal (per-user, sirf login user — spam rokne ke liye)
const buyerQuestionRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  message: "Too many questions asked, please try again later",
  keyBy: (req) => `buyerQuestion:${(req as AuthRequest).user?.id ?? "anonymous"}`,
});

// Preset: lead create (per-user — call/whatsapp/form spam rokne ke liye)
const leadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  message: "Too many lead submissions, please try again later",
  keyBy: (req) => `lead:${(req as AuthRequest).user?.id ?? "anonymous"}`,
});

export {
  rateLimit,
  authRateLimit,
  apiRateLimit,
  otpRateLimit,
  buyerQuestionRateLimit,
  leadRateLimit,
};
