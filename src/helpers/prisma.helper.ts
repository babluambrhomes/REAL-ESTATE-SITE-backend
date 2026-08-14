import { Prisma } from "../generated/prisma/client";
import { ApiError } from "../utils";

export const generateTimestampSuffix = (): string => {
  const date = new Date();
  const datePart =
    `${date.getFullYear()}` +
    `${String(date.getMonth() + 1).padStart(2, "0")}` +
    `${String(date.getDate()).padStart(2, "0")}` +
    `${String(date.getHours()).padStart(2, "0")}` +
    `${String(date.getMinutes()).padStart(2, "0")}` +
    `${String(date.getSeconds()).padStart(2, "0")}`;

  const ms = String(date.getMilliseconds()).padStart(3, "0");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${datePart}-${ms}-${randomPart}`;
};

export const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

export const isRecordNotFound = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";

export const withUniqueRetry = async <T>(
  fn: () => Promise<T>,
  tries = 3
): Promise<T> => {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (isUniqueViolation(err) && i < tries - 1) continue;
      throw err;
    }
  }

  throw new ApiError(500, "Could not complete the request");
};
