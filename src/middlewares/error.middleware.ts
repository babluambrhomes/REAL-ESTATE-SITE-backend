import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils";

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: err.errors || null,
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    data: null,
  });
};

export default errorHandler;
