import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SUPER_ADMIN_TOKEN_COOKIE } from "../lib/cookies";

export default async function HomePage() {
  const cookieStore = await cookies();
  redirect(cookieStore.get(SUPER_ADMIN_TOKEN_COOKIE)?.value ? "/dashboard" : "/login");
}
