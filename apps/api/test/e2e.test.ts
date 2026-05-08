import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";

const app = createApp();

describe("multi-tenant feature flag flow", () => {
  it("keeps organization flags isolated from signup through evaluation", async () => {
    const suffix = Date.now();
    const orgSlug = `e2e-org-${suffix}`;
    const featureKey = `feature_${suffix}`;

    const superLogin = await request(app)
      .post("/v1/auth/super-admin/login")
      .send({ email: env.SUPER_ADMIN_EMAIL, password: env.SUPER_ADMIN_PASSWORD })
      .expect(200);

    const superToken = superLogin.body.data.accessToken;

    const orgCreate = await request(app)
      .post("/v1/super-admin/organizations")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ name: `E2E Org ${suffix}`, slug: orgSlug })
      .expect(201);

    const inviteCode = orgCreate.body.data.adminInviteCode;

    const adminSignup = await request(app)
      .post("/v1/auth/org-admin/signup")
      .send({
        email: `admin-${suffix}@example.test`,
        password: "StrongAdmin123",
        name: "E2E Admin",
        organizationSlug: orgSlug,
        inviteCode,
      })
      .expect(201);

    const adminToken = adminSignup.body.data.accessToken;

    await request(app)
      .post("/v1/admin/feature-flags")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ key: featureKey, enabled: true, description: "E2E flag" })
      .expect(201);

    const userSignup = await request(app)
      .post("/v1/auth/end-user/signup")
      .send({
        email: `user-${suffix}@example.test`,
        password: "StrongUser123",
        name: "E2E User",
        organizationSlug: orgSlug,
      })
      .expect(201);

    const userToken = userSignup.body.data.accessToken;

    const evaluation = await request(app)
      .post("/v1/user/feature-evaluations")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ featureKey })
      .expect(200);

    expect(evaluation.body.data).toMatchObject({
      organizationSlug: orgSlug,
      featureKey,
      enabled: true,
      reason: "MATCH_ENABLED",
    });
  });
});
