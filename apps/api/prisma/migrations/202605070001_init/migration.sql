CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TYPE "RoleName" AS ENUM ('ORG_ADMIN', 'END_USER');

CREATE TABLE "roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" "RoleName" NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles" ("name");

CREATE TABLE "organizations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(64) NOT NULL,
  "admin_invite_code_hash" VARCHAR(128),
  "admin_invite_code_expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations" ("slug");
CREATE INDEX "organizations_slug_idx" ON "organizations" ("slug");

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "email" CITEXT NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_login_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");
CREATE INDEX "users_organization_id_idx" ON "users" ("organization_id");
CREATE INDEX "users_role_id_idx" ON "users" ("role_id");

CREATE TABLE "feature_flags" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "key" VARCHAR(80) NOT NULL,
  "description" VARCHAR(500),
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_flags_organization_id_key_key" ON "feature_flags" ("organization_id", "key");
CREATE INDEX "feature_flags_organization_id_enabled_idx" ON "feature_flags" ("organization_id", "enabled");

CREATE TABLE "refresh_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "user_agent" VARCHAR(255),
  "ip_address" VARCHAR(80),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions" ("token_hash");
CREATE INDEX "refresh_sessions_user_id_idx" ON "refresh_sessions" ("user_id");
CREATE INDEX "refresh_sessions_expires_at_idx" ON "refresh_sessions" ("expires_at");

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID,
  "actor_role" VARCHAR(40) NOT NULL,
  "actor_email" CITEXT,
  "organization_id" UUID,
  "action" VARCHAR(120) NOT NULL,
  "target_type" VARCHAR(80) NOT NULL,
  "target_id" VARCHAR(120),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs" ("organization_id", "created_at");
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs" ("actor_user_id");

ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "roles" ("name", "description") VALUES
  ('ORG_ADMIN', 'Organization administrator with tenant-scoped feature flag permissions'),
  ('END_USER', 'End user who can evaluate feature availability for their organization');
