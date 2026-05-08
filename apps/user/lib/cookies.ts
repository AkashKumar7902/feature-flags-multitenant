export const USER_ACCESS_COOKIE = "byepo_user_access";
export const USER_REFRESH_COOKIE = "byepo_user_refresh";

export const secureCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
