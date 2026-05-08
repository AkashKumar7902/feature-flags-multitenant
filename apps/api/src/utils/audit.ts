import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type { AuthContext } from "../middleware/auth.js";

type AuditInput = {
  actor?: AuthContext;
  organizationId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function auditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor?.role === "SUPER_ADMIN" ? null : input.actor?.sub,
      actorRole: input.actor?.role ?? "SYSTEM",
      actorEmail: input.actor?.email,
      organizationId: input.organizationId ?? input.actor?.organizationId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      metadata: input.metadata,
    },
  });
}
