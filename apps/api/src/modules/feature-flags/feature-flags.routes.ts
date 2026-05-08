import { Router } from "express";
import { z } from "zod";
import {
  createFeatureFlagSchema,
  featureEvaluationSchema,
  publicFeatureEvaluationSchema,
  updateFeatureFlagSchema,
  type ApiFeatureFlag,
  type FeatureEvaluationResponse,
} from "@byepo/contracts";
import { prisma } from "../../db/prisma.js";
import { forbidden, notFound } from "../../http/api-error.js";
import { sendData, sendMessage } from "../../http/send.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { auditLog } from "../../utils/audit.js";

export const adminFeatureFlagsRouter = Router();
export const userFeatureFlagsRouter = Router();
export const publicFeatureFlagsRouter = Router();

const idParamSchema = z.object({ id: z.string().uuid() });
const listQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  enabled: z.enum(["true", "false"]).optional(),
});

function assertOrganizationScope(organizationId?: string) {
  if (!organizationId) {
    throw forbidden("This request is missing tenant scope");
  }
  return organizationId;
}

function serializeFlag(flag: {
  id: string;
  organizationId: string;
  key: string;
  description: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ApiFeatureFlag {
  return {
    id: flag.id,
    organizationId: flag.organizationId,
    key: flag.key,
    description: flag.description,
    enabled: flag.enabled,
    createdAt: flag.createdAt.toISOString(),
    updatedAt: flag.updatedAt.toISOString(),
  };
}

async function evaluateFeature(input: {
  organizationId: string;
  organizationSlug: string;
  featureKey: string;
}): Promise<FeatureEvaluationResponse> {
  const flag = await prisma.featureFlag.findUnique({
    where: {
      organizationId_key: {
        organizationId: input.organizationId,
        key: input.featureKey,
      },
    },
  });

  if (!flag) {
    return {
      organizationSlug: input.organizationSlug,
      featureKey: input.featureKey,
      enabled: false,
      reason: "FLAG_NOT_FOUND",
    };
  }

  return {
    organizationSlug: input.organizationSlug,
    featureKey: input.featureKey,
    enabled: flag.enabled,
    reason: flag.enabled ? "MATCH_ENABLED" : "MATCH_DISABLED",
  };
}

adminFeatureFlagsRouter.use(requireAuth, requireRole("ORG_ADMIN"));

adminFeatureFlagsRouter.get("/feature-flags", validate({ query: listQuerySchema }), async (req, res, next) => {
  try {
    const organizationId = assertOrganizationScope(req.auth?.organizationId);
    const flags = await prisma.featureFlag.findMany({
      where: {
        organizationId,
        ...(req.query.search
          ? {
              OR: [
                { key: { contains: String(req.query.search), mode: "insensitive" } },
                { description: { contains: String(req.query.search), mode: "insensitive" } },
              ],
            }
          : {}),
        ...(req.query.enabled ? { enabled: req.query.enabled === "true" } : {}),
      },
      orderBy: [{ key: "asc" }],
    });

    return sendData(res, { featureFlags: flags.map(serializeFlag) });
  } catch (error) {
    return next(error);
  }
});

adminFeatureFlagsRouter.post(
  "/feature-flags",
  validate({ body: createFeatureFlagSchema }),
  async (req, res, next) => {
    try {
      const organizationId = assertOrganizationScope(req.auth?.organizationId);
      const flag = await prisma.featureFlag.create({
        data: {
          organizationId,
          key: req.body.key,
          description: req.body.description || null,
          enabled: req.body.enabled,
          createdById: req.auth?.sub,
          updatedById: req.auth?.sub,
        },
      });

      await auditLog({
        actor: req.auth,
        organizationId,
        action: "feature_flag.create",
        targetType: "feature_flag",
        targetId: flag.id,
        metadata: { key: flag.key, enabled: flag.enabled },
      });

      return sendData(res, { featureFlag: serializeFlag(flag) }, 201);
    } catch (error) {
      return next(error);
    }
  },
);

adminFeatureFlagsRouter.patch(
  "/feature-flags/:id",
  validate({ params: idParamSchema, body: updateFeatureFlagSchema }),
  async (req, res, next) => {
    try {
      const organizationId = assertOrganizationScope(req.auth?.organizationId);
      const existing = await prisma.featureFlag.findFirst({
        where: { id: String(req.params.id), organizationId },
      });

      if (!existing) throw notFound("Feature flag not found");

      const flag = await prisma.featureFlag.update({
        where: { id: existing.id },
        data: {
          description: req.body.description === undefined ? undefined : req.body.description || null,
          enabled: req.body.enabled,
          updatedById: req.auth?.sub,
        },
      });

      await auditLog({
        actor: req.auth,
        organizationId,
        action: "feature_flag.update",
        targetType: "feature_flag",
        targetId: flag.id,
        metadata: { key: flag.key, enabled: flag.enabled },
      });

      return sendData(res, { featureFlag: serializeFlag(flag) });
    } catch (error) {
      return next(error);
    }
  },
);

adminFeatureFlagsRouter.delete(
  "/feature-flags/:id",
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const organizationId = assertOrganizationScope(req.auth?.organizationId);
      const existing = await prisma.featureFlag.findFirst({ where: { id: String(req.params.id), organizationId } });
      if (!existing) throw notFound("Feature flag not found");

      await prisma.featureFlag.delete({ where: { id: existing.id } });
      await auditLog({
        actor: req.auth,
        organizationId,
        action: "feature_flag.delete",
        targetType: "feature_flag",
        targetId: existing.id,
        metadata: { key: existing.key },
      });

      return sendMessage(res, "Feature flag deleted");
    } catch (error) {
      return next(error);
    }
  },
);

userFeatureFlagsRouter.use(requireAuth, requireRole("END_USER"));

userFeatureFlagsRouter.post(
  "/feature-evaluations",
  validate({ body: featureEvaluationSchema }),
  async (req, res, next) => {
    try {
      const organizationId = assertOrganizationScope(req.auth?.organizationId);
      const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!organization) throw notFound("Organization not found");

      return sendData(
        res,
        await evaluateFeature({
          organizationId,
          organizationSlug: organization.slug,
          featureKey: req.body.featureKey,
        }),
      );
    } catch (error) {
      return next(error);
    }
  },
);

publicFeatureFlagsRouter.post(
  "/feature-evaluations",
  validate({ body: publicFeatureEvaluationSchema }),
  async (req, res, next) => {
    try {
      const organization = await prisma.organization.findUnique({
        where: { slug: req.body.organizationSlug },
      });

      if (!organization) throw notFound("Organization not found");

      return sendData(
        res,
        await evaluateFeature({
          organizationId: organization.id,
          organizationSlug: organization.slug,
          featureKey: req.body.featureKey,
        }),
      );
    } catch (error) {
      return next(error);
    }
  },
);
