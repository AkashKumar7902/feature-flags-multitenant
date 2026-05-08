export const SUPER_ADMIN_TOKEN_COOKIE = "byepo_super_admin_access";

export const secureCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
