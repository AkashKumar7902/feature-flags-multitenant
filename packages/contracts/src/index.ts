import { z } from "zod";

const trimmedString = z.string().trim();

export const emailSchema = trimmedString.email().max(255).transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const organizationSlugSchema = trimmedString
  .min(3)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only");

export const organizationNameSchema = trimmedString.min(2).max(120);

export const featureKeySchema = trimmedString
  .min(2)
  .max(80)
  .regex(/^[a-z][a-z0-9_:-]*$/, "Use a lowercase key like billing_v2 or reports:export");

export const displayNameSchema = trimmedString.min(1).max(120);

export const superAdminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const orgAdminSignupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: displayNameSchema,
  organizationSlug: organizationSlugSchema,
  inviteCode: trimmedString.min(8).max(96),
});

export const orgAdminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const endUserSignupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: displayNameSchema,
  organizationSlug: organizationSlugSchema,
});

export const endUserLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema.optional(),
});

export const rotateInviteSchema = z.object({
  expiresInDays: z.coerce.number().int().min(1).max(90).optional(),
});

export const createFeatureFlagSchema = z.object({
  key: featureKeySchema,
  description: trimmedString.max(500).optional().or(z.literal("")),
  enabled: z.coerce.boolean().default(false),
});

export const updateFeatureFlagSchema = z.object({
  description: trimmedString.max(500).optional().or(z.literal("")),
  enabled: z.coerce.boolean().optional(),
});

export const featureEvaluationSchema = z.object({
  featureKey: featureKeySchema,
});

export const publicFeatureEvaluationSchema = z.object({
  organizationSlug: organizationSlugSchema,
  featureKey: featureKeySchema,
});

export type SuperAdminLoginInput = z.infer<typeof superAdminLoginSchema>;
export type OrgAdminSignupInput = z.infer<typeof orgAdminSignupSchema>;
export type OrgAdminLoginInput = z.infer<typeof orgAdminLoginSchema>;
export type EndUserSignupInput = z.infer<typeof endUserSignupSchema>;
export type EndUserLoginInput = z.infer<typeof endUserLoginSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type RotateInviteInput = z.infer<typeof rotateInviteSchema>;
export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagSchema>;
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;
export type FeatureEvaluationInput = z.infer<typeof featureEvaluationSchema>;
export type PublicFeatureEvaluationInput = z.infer<typeof publicFeatureEvaluationSchema>;

export type ApiRole = "SUPER_ADMIN" | "ORG_ADMIN" | "END_USER";

export type ApiOrganization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  adminCount?: number;
  endUserCount?: number;
  featureFlagCount?: number;
};

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: ApiRole;
  organizationId: string | null;
  organizationSlug?: string;
  organizationName?: string;
};

export type ApiFeatureFlag = {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken?: string;
  user: ApiUser;
};

export type OrganizationCreatedResponse = {
  organization: ApiOrganization;
  adminInviteCode: string;
  adminInviteCodeExpiresAt: string;
};

export type FeatureEvaluationResponse = {
  organizationSlug: string;
  featureKey: string;
  enabled: boolean;
  reason: "MATCH_ENABLED" | "MATCH_DISABLED" | "FLAG_NOT_FOUND";
};
