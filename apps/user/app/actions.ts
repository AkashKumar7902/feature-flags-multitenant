"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthResponse, FeatureEvaluationResponse } from "@byepo/contracts";
import { apiRequest, authHeader } from "../lib/api";
import { USER_ACCESS_COOKIE, USER_REFRESH_COOKIE, secureCookieOptions } from "../lib/cookies";

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

async function setAuthCookies(response: AuthResponse) {
  const cookieStore = await cookies();
  cookieStore.set(USER_ACCESS_COOKIE, response.accessToken, secureCookieOptions);
  if (response.refreshToken) {
    cookieStore.set(USER_REFRESH_COOKIE, response.refreshToken, secureCookieOptions);
  }
}

export async function signupUser(formData: FormData) {
  try {
    const response = await apiRequest<AuthResponse>("/v1/auth/end-user/signup", {
      method: "POST",
      body: JSON.stringify({
        email: value(formData, "email"),
        password: rawValue(formData, "password"),
        name: value(formData, "name"),
        organizationSlug: value(formData, "organizationSlug"),
      }),
    });

    await setAuthCookies(response);
  } catch (error) {
    errorRedirect("/signup", error);
  }

  redirect("/dashboard?notice=Account%20created");
}

export async function loginUser(formData: FormData) {
  try {
    const response = await apiRequest<AuthResponse>("/v1/auth/end-user/login", {
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

export async function logoutUser() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(USER_REFRESH_COOKIE)?.value;

  if (refreshToken) {
    await apiRequest("/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
  }

  cookieStore.delete(USER_ACCESS_COOKIE);
  cookieStore.delete(USER_REFRESH_COOKIE);
  redirect("/login");
}

export async function checkFeature(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_ACCESS_COOKIE)?.value;
  if (!token) redirect("/login");

  let destination = "/dashboard";
  try {
    const response = await apiRequest<FeatureEvaluationResponse>("/v1/user/feature-evaluations", {
      method: "POST",
      headers: authHeader(token),
      body: JSON.stringify({ featureKey: value(formData, "featureKey") }),
    });

    destination = `/dashboard?feature=${encodeURIComponent(response.featureKey)}&enabled=${String(response.enabled)}&reason=${encodeURIComponent(response.reason)}`;
  } catch (error) {
    errorRedirect("/dashboard", error);
  }

  redirect(destination);
}

export async function publicCheckFeature(formData: FormData) {
  let destination = "/public-check";
  try {
    const response = await apiRequest<FeatureEvaluationResponse>("/v1/public/feature-evaluations", {
      method: "POST",
      body: JSON.stringify({
        organizationSlug: value(formData, "organizationSlug"),
        featureKey: value(formData, "featureKey"),
      }),
    });

    destination = `/public-check?organization=${encodeURIComponent(response.organizationSlug)}&feature=${encodeURIComponent(response.featureKey)}&enabled=${String(response.enabled)}&reason=${encodeURIComponent(response.reason)}`;
  } catch (error) {
    errorRedirect("/public-check", error);
  }

  redirect(destination);
}
