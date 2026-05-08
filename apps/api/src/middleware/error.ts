import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ApiError } from "../http/api-error.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, "ROUTE_NOT_FOUND", `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "A record with this unique value already exists",
          details: error.meta,
        },
      });
    }
  }

  const requestWithLog = req as typeof req & { log?: { error: (payload: unknown, message: string) => void } };
  requestWithLog.log?.error({ error }, "Unhandled API error");

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong",
    },
  });
};
