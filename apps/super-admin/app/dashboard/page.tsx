import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ApiOrganization } from "@byepo/contracts";
import { createOrganization, logoutSuperAdmin, rotateOrganizationInvite } from "../actions";
import { apiRequest, authHeader } from "../../lib/api";
import { SUPER_ADMIN_TOKEN_COOKIE } from "../../lib/cookies";

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

async function getOrganizations(token: string) {
  return apiRequest<{ organizations: ApiOrganization[] }>("/v1/super-admin/organizations", {
    headers: authHeader(token),
  });
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPER_ADMIN_TOKEN_COOKIE)?.value;
  if (!token) redirect("/login");

  let organizations: ApiOrganization[] = [];
  try {
    organizations = (await getOrganizations(token)).organizations;
  } catch {
    redirect("/login?error=Please%20login%20again");
  }

  return (
    <main className="shell stack">
      <header className="row">
        <div>
          <span className="badge">Super Admin</span>
          <h1 style={{ fontSize: "2.6rem", marginTop: 8 }}>Organizations</h1>
          <p>Create tenants and hand invite codes to their organization admins.</p>
        </div>
        <form action={logoutSuperAdmin}>
          <button className="secondary" type="submit">Logout</button>
        </form>
      </header>

      {params.error ? <div className="error">{params.error}</div> : null}
      {params.notice ? <div className="notice">{params.notice}</div> : null}
      {params.invite ? (
        <section className="card stack">
          <h2>Admin invite for <code>{params.org}</code></h2>
          <p className="meta">This code is shown only in this response. Store it securely.</p>
          <input readOnly value={params.invite} aria-label="Admin invite code" />
          <p className="meta">Expires: {params.expires ? new Date(params.expires).toLocaleString() : "—"}</p>
        </section>
      ) : null}

      <section className="grid">
        <form action={createOrganization} className="card stack">
          <h2>Create organization</h2>
          <label>
            Organization name
            <input name="name" placeholder="Acme Health" required />
          </label>
          <label>
            Slug <span className="meta">optional; generated when blank</span>
            <input name="slug" placeholder="acme-health" />
          </label>
          <button type="submit">Create organization</button>
        </form>
      </section>

      <section className="card stack">
        <div className="row">
          <h2>All organizations</h2>
          <span className="badge">{organizations.length} tenants</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Admins</th>
              <th>End users</th>
              <th>Flags</th>
              <th>Invite</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((organization) => (
              <tr key={organization.id}>
                <td>{organization.name}</td>
                <td><code>{organization.slug}</code></td>
                <td>{organization.adminCount ?? 0}</td>
                <td>{organization.endUserCount ?? 0}</td>
                <td>{organization.featureFlagCount ?? 0}</td>
                <td>
                  <form action={rotateOrganizationInvite}>
                    <input type="hidden" name="organizationId" value={organization.id} />
                    <button className="secondary" type="submit">Rotate invite</button>
                  </form>
                </td>
              </tr>
            ))}
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={6}>No organizations yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
