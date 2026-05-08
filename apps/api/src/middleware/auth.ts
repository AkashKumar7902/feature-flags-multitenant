import type { NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { forbidden, unauthorized } from "../http/api-error.js";

export type AuthRole = "SUPER_ADMIN" | "ORG_ADMIN" | "END_USER";

export type AuthContext = {
  sub: string;
  email: string;
  role: AuthRole;
  organizationId?: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const encoder = new TextEncoder();
const accessSecret = encoder.encode(env.JWT_ACCESS_SECRET);

export async function createAccessToken(context: AuthContext) {
  return new SignJWT({
    email: context.email,
    role: context.role,
    organizationId: context.organizationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(context.sub)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(accessSecret);
}

async function verifyAccessToken(token: string): Promise<AuthContext> {
  const { payload } = await jwtVerify(token, accessSecret, { algorithms: ["HS256"] });

  if (!payload.sub || typeof payload.email !== "string" || typeof payload.role !== "string") {
    throw unauthorized("Invalid access token");
  }

  if (!["SUPER_ADMIN", "ORG_ADMIN", "END_USER"].includes(payload.role)) {
    throw unauthorized("Invalid access token role");
  }

  const context: AuthContext = {
    sub: payload.sub,
    email: payload.email,
    role: payload.role as AuthRole,
  };

  if (typeof payload.organizationId === "string") {
    context.organizationId = payload.organizationId;
  }

  return context;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return next(unauthorized());
  }

  try {
    req.auth = await verifyAccessToken(token);
    return next();
  } catch (error) {
    return next(error instanceof Error ? unauthorized("Invalid or expired access token") : error);
  }
}

export function requireRole(...roles: AuthRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(unauthorized());
    }

    if (!roles.includes(req.auth.role)) {
      return next(forbidden());
    }

    return next();
  };
}
