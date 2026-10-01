import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../utils";

const validate = (
  schema: z.ZodSchema,
  type: "body" | "query" | "params" = "body"
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[type]);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "root",
        message: issue.message,
        code: issue.code,
      }));

      return next(
        new ApiError(400, "Validation failed", errors)
      );
    }

    if (type !== "query") {
      req[type] = result.data;
    }
    next();
  };
};

// Query parse karne ka shared helper — parsed result req.validatedQuery me store
// hota hai (req.query touch nahi hota), controller usse padhta hai.
const parseQuery = (schema: z.ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "root",
        message: issue.message,
        code: issue.code,
      }));

      return next(
        new ApiError(400, "Validation failed", errors)
      );
    }

    (req as any).validatedQuery = result.data;
    next();
  };
};

export default validate;
export { parseQuery };