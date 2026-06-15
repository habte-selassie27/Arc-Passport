import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { Errors } from "./errors.js";

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body ?? {});
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const code = first?.path.join(".") || "body";
        const msg = first?.message ?? "Invalid request body";
        return next(Errors.MissingFields([code, msg]));
      }
      next(err);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query ?? {});
      (req as Request & { validatedQuery: unknown }).validatedQuery = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const code = first?.path.join(".") || "query";
        const msg = first?.message ?? "Invalid query parameters";
        return next(Errors.MissingFields([code, msg]));
      }
      next(err);
    }
  };
}
