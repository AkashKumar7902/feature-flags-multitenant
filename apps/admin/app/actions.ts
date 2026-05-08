"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthResponse } from "@byepo/contracts";
import { apiRequest, authHeader } from "../lib/api";
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE, secureCookieOptions } from "../lib/cookies";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function rawValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function checked(formData: FormData, key: string) {
  return formData.getAll(key).map(String).includes("true");
}

function errorRedirect(path: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "Something went wrong";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function setAuthCookies(response: AuthResponse) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_ACCESS_COOKIE, response.accessToken, secureCookieOptions);
  if (response.refreshToken) {
    cookieStore.set(ADMIN_REFRESH_COOKIE, response.refreshToken, secureCookieOptions);
  }
}

export async function signupAdmin(formData: FormData) {
  try {
    const response = await apiRequest<AuthResponse>("/v1/auth/org-admin/signup", {
      method: "POST",
      body: JSON.stringify({
        email: value(formData, "email"),
        password: rawValue(formData, "password"),
        name: value(formData, "name"),
        organizationSlug: value(formData, "organizationSlug"),
        inviteCode: value(formData, "inviteCode"),
      }),
    });

    await setAuthCookies(response);
  } catch (error) {
    errorRedirect("/signup", error);
  }

  redirect("/dashboard?notice=Account%20created");
}

export async function loginAdmin(formData: FormData) {
  try {
    const response = await apiRequest<AuthResponse>("/v1/auth/org-admin/login", {
      method: "POST",
      body: JSON.stringify({
        email: value(formData, "email"),
        password: rawValue(formData, "password"),
      }),
    });

    await setAuthCookies(response);
  } catch (error) {
    errorRedirect("/login", error);
  }

  redirect("/dashboard");
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(ADMIN_REFRESH_COOKIE)?.value;

  if (refreshToken) {
    await apiRequest("/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
  }

  cookieStore.delete(ADMIN_ACCESS_COOKIE);
  cookieStore.delete(ADMIN_REFRESH_COOKIE);
  redirect("/login");
}

export async function createFeatureFlag(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value;
  if (!token) redirect("/login");

  try {
    await apiRequest("/v1/admin/feature-flags", {
      method: "POST",
      headers: authHeader(token),
      body: JSON.stringify({
        key: value(formData, "key"),
        description: value(formData, "description"),
        enabled: checked(formData, "enabled"),
      }),
    });
  } catch (error) {
    errorRedirect("/dashboard", error);
  }

  redirect("/dashboard?notice=Feature%20flag%20created");
}

export async function updateFeatureFlag(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value;
  if (!token) redirect("/login");

  try {
    await apiRequest(`/v1/admin/feature-flags/${value(formData, "id")}`, {
      method: "PATCH",
      headers: authHeader(token),
      body: JSON.stringify({
        description: value(formData, "description"),
        enabled: checked(formData, "enabled"),
      }),
    });
  } catch (error) {
    errorRedirect("/dashboard", error);
  }

  redirect("/dashboard?notice=Feature%20flag%20updated");
}

export async function deleteFeatureFlag(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value;
  if (!token) redirect("/login");

  try {
    await apiRequest(`/v1/admin/feature-flags/${value(formData, "id")}`, {
      method: "DELETE",
      headers: authHeader(token),
    });
  } catch (error) {
    errorRedirect("/dashboard", error);
  }

  redirect("/dashboard?notice=Feature%20flag%20deleted");
}
