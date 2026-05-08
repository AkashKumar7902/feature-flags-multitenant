import crypto from "node:crypto";
import { Router } from "express";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import {
  endUserLoginSchema,
  endUserSignupSchema,
  orgAdminLoginSchema,
  orgAdminSignupSchema,
  superAdminLoginSchema,
  type ApiUser,
} from "@byepo/contracts";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { badRequest, conflict, unauthorized } from "../../http/api-error.js";
import { sendData, sendMessage } from "../../http/send.js";
import { createAccessToken, requireAuth, type AuthRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { auditLog } from "../../utils/audit.js";
import {
  addDays,
  constantTimeEqual,
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
} from "../../utils/crypto.js";

export const authRouter = Router();

const refreshBodySchema = z.object({
  refreshToken: z.string().min(32),
});

const logoutBodySchema = z.object({
  refreshToken: z.string().min(32).optional(),
});

type UserWithRelations = Awaited<ReturnType<typeof findUserByEmail>>;

type ExistingUser = NonNullable<UserWithRelations>;

function roleNameToApiRole(roleName: RoleName): Exclude<AuthRole, "SUPER_ADMIN"> {
  return roleName === RoleName.ORG_ADMIN ? "ORG_ADMIN" : "END_USER";
}

function serializeUser(user: ExistingUser): ApiUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: roleNameToApiRole(user.role.name),
    organizationId: user.organizationId,
    organizationSlug: user.organization.slug,
    organizationName: user.organization.name,
  };
}

async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { role: true, organization: true },
  });
}

async function findRoleId(name: RoleName) {
  const role = await prisma.role.findUnique({ where: { name } });
  if (!role) {
    throw new Error(`Missing required role ${name}. Run prisma migrations/seed.`);
  }
  return role.id;
}

async function issueTokensForUser(user: ExistingUser, requestMeta: { userAgent?: string; ipAddress?: string }) {
  const apiRole = roleNameToApiRole(user.role.name);
  const accessToken = await createAccessToken({
    sub: user.id,
    email: user.email,
    role: apiRole,
    organizationId: user.organizationId,
  });

  const refreshToken = randomToken();
  await prisma.refreshSession.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      userAgent: requestMeta.userAgent?.slice(0, 255),
      ipAddress: requestMeta.ipAddress?.slice(0, 80),
      expiresAt: addDays(new Date(), env.REFRESH_TOKEN_TTL_DAYS),
    },
  });

  return { accessToken, refreshToken, user: serializeUser(user) };
}

function hashRefreshToken(refreshToken: string) {
  return crypto.createHmac("sha256", env.JWT_REFRESH_SECRET).update(refreshToken).digest("hex");
}

function requestMeta(req: import("express").Request) {
  return {
    userAgent: req.header("user-agent") ?? undefined,
    ipAddress: req.ip,
  };
}

async function loginAsRole(input: { email: string; password: string; role: RoleName }, req: import("express").Request) {
  const user = await findUserByEmail(input.email);
  if (!user || user.deletedAt || user.role.name !== input.role) {
    throw unauthorized("Invalid email or password");
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password);
  if (!passwordOk) {
    throw unauthorized("Invalid email or password");
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await auditLog({
    actor: {
      sub: user.id,
      email: user.email,
      role: roleNameToApiRole(user.role.name),
      organizationId: user.organizationId,
    },
    action: "auth.login",
    targetType: "user",
    targetId: user.id,
  });

  return issueTokensForUser(user, requestMeta(req));
}

authRouter.post("/super-admin/login", validate({ body: superAdminLoginSchema }), async (req, res, next) => {
  try {
    const emailOk = req.body.email === env.SUPER_ADMIN_EMAIL.toLowerCase();
    const passwordOk = constantTimeEqual(sha256(req.body.password), sha256(env.SUPER_ADMIN_PASSWORD));

    if (!emailOk || !passwordOk) {
      throw unauthorized("Invalid email or password");
    }

    const accessToken = await createAccessToken({
      sub: "super-admin",
      email: env.SUPER_ADMIN_EMAIL.toLowerCase(),
      role: "SUPER_ADMIN",
    });

    await auditLog({
      actor: {
        sub: "super-admin",
        email: env.SUPER_ADMIN_EMAIL.toLowerCase(),
        role: "SUPER_ADMIN",
      },
      action: "auth.super_admin_login",
      targetType: "super_admin",
      targetId: "super-admin",
    });

    return sendData(res, {
      accessToken,
      user: {
        id: "super-admin",
        email: env.SUPER_ADMIN_EMAIL.toLowerCase(),
        name: "Super Admin",
        role: "SUPER_ADMIN",
        organizationId: null,
      } satisfies ApiUser,
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/org-admin/signup", validate({ body: orgAdminSignupSchema }), async (req, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { slug: req.body.organizationSlug },
    });

    if (!organization?.adminInviteCodeHash) {
      throw unauthorized("Invalid organization invite");
    }

    if (
      organization.adminInviteCodeExpiresAt &&
      organization.adminInviteCodeExpiresAt.getTime() < Date.now()
    ) {
      throw unauthorized("Organization invite has expired");
    }

    const inviteHash = sha256(req.body.inviteCode);
    if (!constantTimeEqual(inviteHash, organization.adminInviteCodeHash)) {
      throw unauthorized("Invalid organization invite");
    }

    const existing = await findUserByEmail(req.body.email);
    if (existing) {
      throw conflict("An account with this email already exists");
    }

    const roleId = await findRoleId(RoleName.ORG_ADMIN);
    const passwordHash = await hashPassword(req.body.password);

    const user = await prisma.user.create({
      data: {
        email: req.body.email,
        passwordHash,
        name: req.body.name,
        organizationId: organization.id,
        roleId,
      },
      include: { role: true, organization: true },
    });

    await auditLog({
      actor: {
        sub: user.id,
        email: user.email,
        role: "ORG_ADMIN",
        organizationId: organization.id,
      },
      action: "auth.org_admin_signup",
      targetType: "user",
      targetId: user.id,
    });

    return sendData(res, await issueTokensForUser(user, requestMeta(req)), 201);
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/org-admin/login", validate({ body: orgAdminLoginSchema }), async (req, res, next) => {
  try {
    return sendData(
      res,
      await loginAsRole({ email: req.body.email, password: req.body.password, role: RoleName.ORG_ADMIN }, req),
    );
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/end-user/signup", validate({ body: endUserSignupSchema }), async (req, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { slug: req.body.organizationSlug },
    });

    if (!organization) {
      throw badRequest("Organization does not exist");
    }

    const existing = await findUserByEmail(req.body.email);
    if (existing) {
      throw conflict("An account with this email already exists");
    }

    const roleId = await findRoleId(RoleName.END_USER);
    const passwordHash = await hashPassword(req.body.password);

    const user = await prisma.user.create({
      data: {
        email: req.body.email,
        passwordHash,
        name: req.body.name,
        organizationId: organization.id,
        roleId,
      },
      include: { role: true, organization: true },
    });

    await auditLog({
      actor: {
        sub: user.id,
        email: user.email,
        role: "END_USER",
        organizationId: organization.id,
      },
      action: "auth.end_user_signup",
      targetType: "user",
      targetId: user.id,
    });

    return sendData(res, await issueTokensForUser(user, requestMeta(req)), 201);
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/end-user/login", validate({ body: endUserLoginSchema }), async (req, res, next) => {
  try {
    return sendData(
      res,
      await loginAsRole({ email: req.body.email, password: req.body.password, role: RoleName.END_USER }, req),
    );
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/refresh", validate({ body: refreshBodySchema }), async (req, res, next) => {
  try {
    const tokenHash = hashRefreshToken(req.body.refreshToken);
    const session = await prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { role: true, organization: true },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now() || session.user.deletedAt) {
      throw unauthorized("Invalid refresh token");
    }

    const newRefreshToken = randomToken();
    await prisma.$transaction([
      prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshSession.create({
        data: {
          userId: session.userId,
          tokenHash: hashRefreshToken(newRefreshToken),
          userAgent: req.header("user-agent")?.slice(0, 255),
          ipAddress: req.ip?.slice(0, 80),
          expiresAt: addDays(new Date(), env.REFRESH_TOKEN_TTL_DAYS),
        },
      }),
    ]);

    const accessToken = await createAccessToken({
      sub: session.user.id,
      email: session.user.email,
      role: roleNameToApiRole(session.user.role.name),
      organizationId: session.user.organizationId,
    });

    return sendData(res, {
      accessToken,
      refreshToken: newRefreshToken,
      user: serializeUser(session.user),
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/logout", validate({ body: logoutBodySchema }), async (req, res, next) => {
  try {
    if (req.body.refreshToken) {
      await prisma.refreshSession.updateMany({
        where: { tokenHash: hashRefreshToken(req.body.refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return sendMessage(res, "Logged out");
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    if (req.auth?.role === "SUPER_ADMIN") {
      return sendData(res, {
        id: "super-admin",
        email: env.SUPER_ADMIN_EMAIL.toLowerCase(),
        name: "Super Admin",
        role: "SUPER_ADMIN",
        organizationId: null,
      } satisfies ApiUser);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.sub },
      include: { role: true, organization: true },
    });

    if (!user || user.deletedAt) {
      throw unauthorized("User no longer exists");
    }

    return sendData(res, serializeUser(user));
  } catch (error) {
    return next(error);
  }
});
