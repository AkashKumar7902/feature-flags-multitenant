import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { badRequest } from "../http/api-error.js";

type Schemas = {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
};

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: Record<string, unknown> = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) errors.body = result.error.flatten();
      else req.body = result.data;
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) errors.params = result.error.flatten();
      else req.params = result.data as typeof req.params;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) errors.query = result.error.flatten();
      else Object.defineProperty(req, "query", { value: result.data, writable: true, configurable: true });
    }

    if (Object.keys(errors).length > 0) {
      return next(badRequest("Validation failed", errors));
    }

    next();
  };
}
