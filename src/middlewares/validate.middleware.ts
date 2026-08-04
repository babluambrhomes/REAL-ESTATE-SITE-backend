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

    req[type] = result.data;
    next();
  };
};

export default validate;