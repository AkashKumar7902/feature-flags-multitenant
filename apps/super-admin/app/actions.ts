"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthResponse, OrganizationCreatedResponse } from "@byepo/contracts";
import { apiRequest, authHeader } from "../lib/api";
import { secureCookieOptions, SUPER_ADMIN_TOKEN_COOKIE } from "../lib/cookies";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function rawValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function errorRedirect(path: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "Something went wrong";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function loginSuperAdmin(formData: FormData) {
  try {
    const response = await apiRequest<AuthResponse>("/v1/auth/super-admin/login", {
      method: "POST",
      body: JSON.stringify({
        email: value(formData, "email"),
        password: rawValue(formData, "password"),
      }),
    });

    const cookieStore = await cookies();
    cookieStore.set(SUPER_ADMIN_TOKEN_COOKIE, response.accessToken, secureCookieOptions);
  } catch (error) {
    errorRedirect("/login", error);
  }

  redirect("/dashboard");
}

export async function logoutSuperAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(SUPER_ADMIN_TOKEN_COOKIE);
  redirect("/login");
}

export async function createOrganization(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPER_ADMIN_TOKEN_COOKIE)?.value;
  if (!token) redirect("/login");

  let destination = "/dashboard";
  try {
    const body: Record<string, string> = { name: value(formData, "name") };
    const slug = value(formData, "slug");
    if (slug) body.slug = slug;

    const response = await apiRequest<OrganizationCreatedResponse>("/v1/super-admin/organizations", {
      method: "POST",
      headers: authHeader(token),
      body: JSON.stringify(body),
    });

    destination = `/dashboard?notice=${encodeURIComponent("Organization created. Copy the invite code now.")}&org=${encodeURIComponent(response.organization.slug)}&invite=${encodeURIComponent(response.adminInviteCode)}&expires=${encodeURIComponent(response.adminInviteCodeExpiresAt)}`;
  } catch (error) {
    errorRedirect("/dashboard", error);
  }

  redirect(destination);
}

export async function rotateOrganizationInvite(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPER_ADMIN_TOKEN_COOKIE)?.value;
  if (!token) redirect("/login");

  let destination = "/dashboard";
  try {
    const organizationId = value(formData, "organizationId");
    const response = await apiRequest<OrganizationCreatedResponse>(
      `/v1/super-admin/organizations/${organizationId}/rotate-admin-invite`,
      {
        method: "POST",
        headers: authHeader(token),
        body: JSON.stringify({ expiresInDays: 30 }),
      },
    );

    destination = `/dashboard?notice=${encodeURIComponent("Invite rotated. Copy the new code now.")}&org=${encodeURIComponent(response.organization.slug)}&invite=${encodeURIComponent(response.adminInviteCode)}&expires=${encodeURIComponent(response.adminInviteCodeExpiresAt)}`;
  } catch (error) {
    errorRedirect("/dashboard", error);
  }

  redirect(destination);
}
