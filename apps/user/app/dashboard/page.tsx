import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ApiUser } from "@byepo/contracts";
import { checkFeature, logoutUser } from "../actions";
import { apiRequest, authHeader } from "../../lib/api";
import { USER_ACCESS_COOKIE } from "../../lib/cookies";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

async function getMe(token: string) {
  return apiRequest<ApiUser>("/v1/auth/me", { headers: authHeader(token) });
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_ACCESS_COOKIE)?.value;
  if (!token) redirect("/login");

  let me: ApiUser;
  try {
    me = await getMe(token);
  } catch {
    redirect("/login?error=Please%20login%20again");
  }

  const hasResult = params.feature && params.enabled;
  const enabled = params.enabled === "true";

  return (
    <main className="shell stack">
      <header className="row">
        <div>
          <span className="badge">{me.organizationName}</span>
          <h1 style={{ fontSize: "2.5rem", marginTop: 8 }}>Feature check</h1>
          <p>
            Signed in as {me.name} · tenant <code>{me.organizationSlug}</code>
          </p>
        </div>
        <form action={logoutUser}>
          <button className="secondary" type="submit">Logout</button>
        </form>
      </header>

      {params.error ? <div className="error">{params.error}</div> : null}
      {params.notice ? <div className="notice">{params.notice}</div> : null}

      <section className="grid">
        <form action={checkFeature} className="card stack">
          <h2>Check a feature</h2>
          <label>
            Feature key
            <input name="featureKey" placeholder="smart_dashboard" required />
          </label>
          <button type="submit">Check feature</button>
          <p className="meta">Try seeded keys: <code>smart_dashboard</code> or <code>billing_v2</code>.</p>
        </form>

        <section className="card stack">
          <h2>Result</h2>
          {hasResult ? (
            <div className={enabled ? "result enabled" : "result disabled"}>
              <code>{params.feature}</code> is {enabled ? "enabled" : "disabled"}
              <p className="meta">Reason: {params.reason}</p>
            </div>
          ) : (
            <p>Submit a feature key to see whether it is enabled for your organization.</p>
          )}
        </section>
      </section>
    </main>
  );
}
