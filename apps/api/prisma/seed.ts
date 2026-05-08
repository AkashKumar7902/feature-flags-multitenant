import "dotenv/config";
import { PrismaClient, RoleName } from "@prisma/client";
import { addDays, hashPassword, sha256 } from "../src/utils/crypto.js";

const prisma = new PrismaClient();

const ACME_ADMIN_INVITE = "acme-admin-invite-2026";
const BETA_ADMIN_INVITE = "beta-admin-invite-2026";
const ADMIN_PASSWORD = "AcmeAdmin#123";
const USER_PASSWORD = "AcmeUser#123";

async function main() {
  const orgAdminRole = await prisma.role.upsert({
    where: { name: RoleName.ORG_ADMIN },
    update: {},
    create: {
      name: RoleName.ORG_ADMIN,
      description: "Organization administrator with tenant-scoped feature flag permissions",
    },
  });

  const endUserRole = await prisma.role.upsert({
    where: { name: RoleName.END_USER },
    update: {},
    create: {
      name: RoleName.END_USER,
      description: "End user who can evaluate feature availability for their organization",
    },
  });

  const acme = await prisma.organization.upsert({
    where: { slug: "acme-health" },
    update: {
      name: "Acme Health",
      adminInviteCodeHash: sha256(ACME_ADMIN_INVITE),
      adminInviteCodeExpiresAt: addDays(new Date(), 365),
    },
    create: {
      name: "Acme Health",
      slug: "acme-health",
      adminInviteCodeHash: sha256(ACME_ADMIN_INVITE),
      adminInviteCodeExpiresAt: addDays(new Date(), 365),
    },
  });

  const beta = await prisma.organization.upsert({
    where: { slug: "beta-retail" },
    update: {
      name: "Beta Retail",
      adminInviteCodeHash: sha256(BETA_ADMIN_INVITE),
      adminInviteCodeExpiresAt: addDays(new Date(), 365),
    },
    create: {
      name: "Beta Retail",
      slug: "beta-retail",
      adminInviteCodeHash: sha256(BETA_ADMIN_INVITE),
      adminInviteCodeExpiresAt: addDays(new Date(), 365),
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@acme.test" },
    update: {
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      name: "Acme Admin",
      organizationId: acme.id,
      roleId: orgAdminRole.id,
      deletedAt: null,
    },
    create: {
      email: "admin@acme.test",
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      name: "Acme Admin",
      organizationId: acme.id,
      roleId: orgAdminRole.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "user@acme.test" },
    update: {
      passwordHash: await hashPassword(USER_PASSWORD),
      name: "Acme User",
      organizationId: acme.id,
      roleId: endUserRole.id,
      deletedAt: null,
    },
    create: {
      email: "user@acme.test",
      passwordHash: await hashPassword(USER_PASSWORD),
      name: "Acme User",
      organizationId: acme.id,
      roleId: endUserRole.id,
    },
  });

  await prisma.featureFlag.upsert({
    where: { organizationId_key: { organizationId: acme.id, key: "smart_dashboard" } },
    update: { enabled: true, description: "New dashboard experience for Acme users" },
    create: {
      organizationId: acme.id,
      key: "smart_dashboard",
      enabled: true,
      description: "New dashboard experience for Acme users",
    },
  });

  await prisma.featureFlag.upsert({
    where: { organizationId_key: { organizationId: acme.id, key: "billing_v2" } },
    update: { enabled: false, description: "Second-generation billing flow" },
    create: {
      organizationId: acme.id,
      key: "billing_v2",
      enabled: false,
      description: "Second-generation billing flow",
    },
  });

  await prisma.featureFlag.upsert({
    where: { organizationId_key: { organizationId: beta.id, key: "smart_dashboard" } },
    update: { enabled: false, description: "Tenant-isolated flag with the same key as Acme" },
    create: {
      organizationId: beta.id,
      key: "smart_dashboard",
      enabled: false,
      description: "Tenant-isolated flag with the same key as Acme",
    },
  });

  console.log("Seed complete");
  console.table([
    { app: "Super Admin", email: "super@byepo.local", password: "set in SUPER_ADMIN_PASSWORD" },
    { app: "Admin", email: "admin@acme.test", password: ADMIN_PASSWORD, org: "acme-health" },
    { app: "User", email: "user@acme.test", password: USER_PASSWORD, org: "acme-health" },
    { app: "Admin Signup Invite", org: "acme-health", invite: ACME_ADMIN_INVITE },
    { app: "Admin Signup Invite", org: "beta-retail", invite: BETA_ADMIN_INVITE },
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
