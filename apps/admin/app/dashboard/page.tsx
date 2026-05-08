import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ApiFeatureFlag, ApiUser } from "@byepo/contracts";
import {
  createFeatureFlag,
  deleteFeatureFlag,
  logoutAdmin,
  updateFeatureFlag,
} from "../actions";
import { apiRequest, authHeader } from "../../lib/api";
import { ADMIN_ACCESS_COOKIE } from "../../lib/cookies";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

async function getAdminDashboardData(token: string) {
  const [me, flags] = await Promise.all([
    apiRequest<ApiUser>("/v1/auth/me", { headers: authHeader(token) }),
    apiRequest<{ featureFlags: ApiFeatureFlag[] }>("/v1/admin/feature-flags", {
      headers: authHeader(token),
    }),
  ]);

  return { me, flags: flags.featureFlags };
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value;
  if (!token) redirect("/login");

  let data: Awaited<ReturnType<typeof getAdminDashboardData>>;
  try {
    data = await getAdminDashboardData(token);
  } catch {
    redirect("/login?error=Please%20login%20again");
  }

  return (
    <main className="shell stack">
      <header className="row">
        <div>
          <span className="badge">{data.me.organizationName}</span>
          <h1 style={{ fontSize: "2.5rem", marginTop: 8 }}>Feature flags</h1>
          <p>
            Signed in as {data.me.name} · tenant <code>{data.me.organizationSlug}</code>
          </p>
        </div>
        <form action={logoutAdmin}>
          <button className="secondary" type="submit">Logout</button>
        </form>
      </header>

      {params.error ? <div className="error">{params.error}</div> : null}
      {params.notice ? <div className="notice">{params.notice}</div> : null}

      <section className="grid">
        <form action={createFeatureFlag} className="card stack">
          <h2>Create flag</h2>
          <label>
            Feature key
            <input name="key" placeholder="billing_v2" required />
          </label>
          <label>
            Description
            <textarea name="description" placeholder="What this flag controls" />
          </label>
          <label className="checkbox">
            <input type="checkbox" name="enabled" value="true" />
            Enabled
          </label>
          <button type="submit">Create feature flag</button>
        </form>
      </section>

      <section className="stack">
        <div className="row">
          <h2>Existing flags</h2>
          <span className="badge">{data.flags.length} flags</span>
        </div>
        <div className="grid">
          {data.flags.map((flag) => (
            <article className="card stack" key={flag.id}>
              <div className="row">
                <h2><code>{flag.key}</code></h2>
                <span className={flag.enabled ? "status on" : "status off"}>
                  {flag.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              <form action={updateFeatureFlag} className="stack">
                <input type="hidden" name="id" value={flag.id} />
                <label>
                  Description
                  <textarea name="description" defaultValue={flag.description ?? ""} />
                </label>
                <label className="checkbox">
                  <input type="checkbox" name="enabled" value="true" defaultChecked={flag.enabled} />
                  Enabled for this organization
                </label>
                <button type="submit">Save changes</button>
              </form>

              <div className="row meta">
                <span>Updated {new Date(flag.updatedAt).toLocaleString()}</span>
                <form action={deleteFeatureFlag}>
                  <input type="hidden" name="id" value={flag.id} />
                  <button className="danger" type="submit">Delete</button>
                </form>
              </div>
            </article>
          ))}
          {data.flags.length === 0 ? (
            <section className="card">
              <p>No feature flags yet. Create your first flag above.</p>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
