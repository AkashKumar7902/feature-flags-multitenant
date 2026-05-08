import Link from "next/link";
import { publicCheckFeature } from "../actions";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function PublicCheckPage({ searchParams }: Props) {
  const params = await searchParams;
  const hasResult = params.feature && params.enabled;
  const enabled = params.enabled === "true";

  return (
    <main className="shell hero">
      <section className="stack">
        <span className="badge">Public Demo Checker</span>
        <h1>Evaluate by slug</h1>
        <p>
          The assignment’s required end-user screen can be tested here without creating a user. The
          authenticated dashboard is stricter and reads the organization from the user token.
        </p>
        <p className="meta">
          Prefer a real user flow? <Link href="/login">Login</Link>
        </p>
      </section>

      <section className="card stack">
        <form action={publicCheckFeature} className="stack">
          <h2>Public feature check</h2>
          {params.error ? <div className="error">{params.error}</div> : null}
          <label>
            Organization slug
            <input name="organizationSlug" placeholder="acme-health" required />
          </label>
          <label>
            Feature key
            <input name="featureKey" placeholder="smart_dashboard" required />
          </label>
          <button type="submit">Check feature</button>
        </form>

        {hasResult ? (
          <div className={enabled ? "result enabled" : "result disabled"}>
            <code>{params.feature}</code> is {enabled ? "enabled" : "disabled"} for{" "}
            <code>{params.organization}</code>
            <p className="meta">Reason: {params.reason}</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
