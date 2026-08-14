import { Request, Response, NextFunction } from "express";
import multer from "multer";
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

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large"
        : `Upload failed: ${err.message}`;
    res.status(400).json({
      success: false,
      message,
      data: null,
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
