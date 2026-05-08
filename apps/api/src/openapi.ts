export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Byepo Feature Flags API",
    version: "1.0.0",
    description:
      "Multi-tenant feature flag service with Super Admin, Organization Admin, and End User roles. " +
      "All authenticated routes use Bearer access tokens. Tenant scope is read from the token, never from the request body.",
  },
  servers: [
    { url: "/", description: "Current host" },
    { url: "http://localhost:4000", description: "Local development" },
  ],
  tags: [
    { name: "Auth", description: "Login, signup, refresh, logout, and current user lookup" },
    { name: "Super Admin", description: "Manage organizations and admin invite codes" },
    { name: "Admin", description: "Manage feature flags within the authenticated tenant" },
    { name: "User", description: "Authenticated end-user feature evaluation" },
    { name: "Public", description: "Unauthenticated demo feature evaluation" },
    { name: "Health", description: "Service liveness" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "BAD_REQUEST" },
              message: { type: "string", example: "Validation failed" },
              details: { type: "object", nullable: true },
            },
          },
        },
      },
      AuthUser: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          name: { type: "string", nullable: true },
          role: { type: "string", enum: ["SUPER_ADMIN", "ORG_ADMIN", "END_USER"] },
          organizationId: { type: "string", format: "uuid", nullable: true },
          organizationSlug: { type: "string", nullable: true },
          organizationName: { type: "string", nullable: true },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string", nullable: true },
          user: { $ref: "#/components/schemas/AuthUser" },
        },
      },
      Organization: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          slug: { type: "string" },
          adminCount: { type: "integer" },
          endUserCount: { type: "integer" },
          featureFlagCount: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      FeatureFlag: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          organizationId: { type: "string", format: "uuid" },
          key: { type: "string", example: "smart_dashboard" },
          description: { type: "string", nullable: true },
          enabled: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      FeatureEvaluation: {
        type: "object",
        properties: {
          organizationSlug: { type: "string" },
          featureKey: { type: "string" },
          enabled: { type: "boolean" },
          reason: {
            type: "string",
            enum: ["MATCH_ENABLED", "MATCH_DISABLED", "FLAG_NOT_FOUND"],
          },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid access token",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Forbidden: {
        description: "Token is valid but lacks the required role or tenant scope",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      ValidationError: {
        description: "Request body, params, or query failed validation",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      NotFound: {
        description: "Resource not found",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Service liveness check",
        responses: {
          200: {
            description: "Service is up",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        status: { type: "string", example: "ok" },
                        service: { type: "string" },
                        time: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/auth/super-admin/login": {
      post: {
        tags: ["Auth"],
        summary: "Super admin login (env-based credentials)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "super@byepo.local" },
                  password: { type: "string", example: "SuperAdmin#2026" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Authenticated",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/v1/auth/org-admin/signup": {
      post: {
        tags: ["Auth"],
        summary: "Organization admin signup with invite code",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name", "organizationSlug", "inviteCode"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string" },
                  organizationSlug: { type: "string", example: "acme-health" },
                  inviteCode: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Account created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/v1/auth/org-admin/login": {
      post: {
        tags: ["Auth"],
        summary: "Organization admin login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "admin@acme.test" },
                  password: { type: "string", example: "AcmeAdmin#123" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Authenticated",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/v1/auth/end-user/signup": {
      post: {
        tags: ["Auth"],
        summary: "End user signup",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name", "organizationSlug"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string" },
                  organizationSlug: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Account created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          400: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/v1/auth/end-user/login": {
      post: {
        tags: ["Auth"],
        summary: "End user login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "user@acme.test" },
                  password: { type: "string", example: "AcmeUser#123" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Authenticated",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/v1/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Exchange a refresh token for a new access/refresh pair",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: { refreshToken: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "New tokens issued",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Revoke a refresh token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: { refreshToken: { type: "string" } },
              },
            },
          },
        },
        responses: { 200: { description: "Logged out" } },
      },
    },
    "/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Return the authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Current user",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthUser" } } },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/v1/super-admin/organizations": {
      get: {
        tags: ["Super Admin"],
        summary: "List all organizations",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "List of organizations",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    organizations: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Organization" },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Super Admin"],
        summary: "Create an organization (returns one-time invite code)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "Acme Health" },
                  slug: { type: "string", example: "acme-health", description: "Optional. Generated when blank." },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Organization created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    organization: { $ref: "#/components/schemas/Organization" },
                    invite: {
                      type: "object",
                      properties: {
                        code: { type: "string", description: "Plaintext invite, only shown once" },
                        expiresAt: { type: "string", format: "date-time", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/v1/super-admin/organizations/{id}/rotate-admin-invite": {
      post: {
        tags: ["Super Admin"],
        summary: "Rotate the admin invite code for an organization",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: {
            description: "New invite code",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    code: { type: "string" },
                    expiresAt: { type: "string", format: "date-time", nullable: true },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/v1/admin/feature-flags": {
      get: {
        tags: ["Admin"],
        summary: "List feature flags for the authenticated tenant",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "search", in: "query", schema: { type: "string", maxLength: 80 } },
          { name: "enabled", in: "query", schema: { type: "string", enum: ["true", "false"] } },
        ],
        responses: {
          200: {
            description: "Feature flag list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    featureFlags: {
                      type: "array",
                      items: { $ref: "#/components/schemas/FeatureFlag" },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "Create a feature flag in the authenticated tenant",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["key", "enabled"],
                properties: {
                  key: { type: "string", example: "billing_v2" },
                  description: { type: "string", nullable: true },
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Feature flag created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { featureFlag: { $ref: "#/components/schemas/FeatureFlag" } },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          409: {
            description: "A flag with this key already exists in the tenant",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/v1/admin/feature-flags/{id}": {
      patch: {
        tags: ["Admin"],
        summary: "Update an existing flag",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  description: { type: "string", nullable: true },
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Flag updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { featureFlag: { $ref: "#/components/schemas/FeatureFlag" } },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Admin"],
        summary: "Delete a flag",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Flag deleted" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/v1/user/feature-evaluations": {
      post: {
        tags: ["User"],
        summary: "Evaluate a feature for the authenticated end user",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["featureKey"],
                properties: { featureKey: { type: "string", example: "smart_dashboard" } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Evaluation result",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FeatureEvaluation" } } },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/v1/public/feature-evaluations": {
      post: {
        tags: ["Public"],
        summary: "Unauthenticated demo evaluation by org slug + feature key",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["organizationSlug", "featureKey"],
                properties: {
                  organizationSlug: { type: "string", example: "acme-health" },
                  featureKey: { type: "string", example: "smart_dashboard" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Evaluation result",
            content: { "application/json": { schema: { $ref: "#/components/schemas/FeatureEvaluation" } } },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
  },
} as const;
