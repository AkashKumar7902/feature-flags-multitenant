export const ADMIN_ACCESS_COOKIE = "byepo_admin_access";
export const ADMIN_REFRESH_COOKIE = "byepo_admin_refresh";

export const secureCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
