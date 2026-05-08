import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_ACCESS_COOKIE } from "../lib/cookies";

export default async function HomePage() {
  const cookieStore = await cookies();
  redirect(cookieStore.get(ADMIN_ACCESS_COOKIE)?.value ? "/dashboard" : "/login");
}
