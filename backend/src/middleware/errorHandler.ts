import { Request, Response, NextFunction } from "express";
import { ArcPassError } from "../utils/errors.js";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ArcPassError) {
    res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.context ? { context: err.context } : {}),
      },
    });
    return;
  }

  console.error("[unhandled error]", err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
