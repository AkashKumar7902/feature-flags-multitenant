import { Router } from "express";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import {
  createOrganizationSchema,
  rotateInviteSchema,
  type ApiOrganization,
  type OrganizationCreatedResponse,
} from "@byepo/contracts";
import { prisma } from "../../db/prisma.js";
import { badRequest, conflict, notFound } from "../../http/api-error.js";
import { sendData } from "../../http/send.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { auditLog } from "../../utils/audit.js";
import { addDays, createInviteCode, sha256, slugify } from "../../utils/crypto.js";

export const organizationsRouter = Router();

const idParamSchema = z.object({ id: z.string().uuid() });

organizationsRouter.use(requireAuth, requireRole("SUPER_ADMIN"));

async function buildApiOrganizations(): Promise<ApiOrganization[]> {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { featureFlags: true } } },
  });

  const roleRows = await prisma.role.findMany({ where: { name: { in: [RoleName.ORG_ADMIN, RoleName.END_USER] } } });
  const adminRoleId = roleRows.find((role) => role.name === RoleName.ORG_ADMIN)?.id;
  const endUserRoleId = roleRows.find((role) => role.name === RoleName.END_USER)?.id;

  const userCounts = organizations.length
    ? await prisma.user.groupBy({
        by: ["organizationId", "roleId"],
        where: { organizationId: { in: organizations.map((organization) => organization.id) }, deletedAt: null },
        _count: { _all: true },
      })
    : [];

  const countMap = new Map<string, { admins: number; endUsers: number }>();
  for (const organization of organizations) {
    countMap.set(organization.id, { admins: 0, endUsers: 0 });
  }

  for (const count of userCounts) {
    const entry = countMap.get(count.organizationId);
    if (!entry) continue;
    if (count.roleId === adminRoleId) entry.admins = count._count._all;
    if (count.roleId === endUserRoleId) entry.endUsers = count._count._all;
  }

  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    adminCount: countMap.get(organization.id)?.admins ?? 0,
    endUserCount: countMap.get(organization.id)?.endUsers ?? 0,
    featureFlagCount: organization._count.featureFlags,
  }));
}

async function createAvailableSlug(name: string) {
  const base = slugify(name);
  if (!base) {
    throw badRequest("Organization name cannot produce a valid slug");
  }

  for (let suffix = 0; suffix < 20; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const existing = await prisma.organization.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }

  throw conflict("Could not create a unique organization slug");
}

function serializeOrganization(organization: {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}): ApiOrganization {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
  };
}

organizationsRouter.get("/organizations", async (_req, res, next) => {
  try {
    return sendData(res, { organizations: await buildApiOrganizations() });
  } catch (error) {
    return next(error);
  }
});

organizationsRouter.post("/organizations", validate({ body: createOrganizationSchema }), async (req, res, next) => {
  try {
    const slug = req.body.slug ?? (await createAvailableSlug(req.body.name));

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      throw conflict("An organization with this slug already exists");
    }

    const adminInviteCode = createInviteCode(slug);
    const adminInviteCodeExpiresAt = addDays(new Date(), 30);

    const organization = await prisma.organization.create({
      data: {
        name: req.body.name,
        slug,
        adminInviteCodeHash: sha256(adminInviteCode),
        adminInviteCodeExpiresAt,
      },
    });

    await auditLog({
      actor: req.auth,
      organizationId: organization.id,
      action: "organization.create",
      targetType: "organization",
      targetId: organization.id,
      metadata: { slug: organization.slug },
    });

    const payload: OrganizationCreatedResponse = {
      organization: serializeOrganization(organization),
      adminInviteCode,
      adminInviteCodeExpiresAt: adminInviteCodeExpiresAt.toISOString(),
    };

    return sendData(res, payload, 201);
  } catch (error) {
    return next(error);
  }
});

organizationsRouter.get("/organizations/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({ where: { id: String(req.params.id) } });
    if (!organization) throw notFound("Organization not found");

    return sendData(res, { organization: serializeOrganization(organization) });
  } catch (error) {
    return next(error);
  }
});

organizationsRouter.post(
  "/organizations/:id/rotate-admin-invite",
  validate({ params: idParamSchema, body: rotateInviteSchema }),
  async (req, res, next) => {
    try {
      const existing = await prisma.organization.findUnique({ where: { id: String(req.params.id) } });
      if (!existing) throw notFound("Organization not found");

      const adminInviteCode = createInviteCode(existing.slug);
      const adminInviteCodeExpiresAt = addDays(new Date(), req.body.expiresInDays ?? 30);

      const organization = await prisma.organization.update({
        where: { id: existing.id },
        data: {
          adminInviteCodeHash: sha256(adminInviteCode),
          adminInviteCodeExpiresAt,
        },
      });

      await auditLog({
        actor: req.auth,
        organizationId: organization.id,
        action: "organization.rotate_admin_invite",
        targetType: "organization",
        targetId: organization.id,
      });

      return sendData(res, {
        organization: serializeOrganization(organization),
        adminInviteCode,
        adminInviteCodeExpiresAt: adminInviteCodeExpiresAt.toISOString(),
      } satisfies OrganizationCreatedResponse);
    } catch (error) {
      return next(error);
    }
  },
);
