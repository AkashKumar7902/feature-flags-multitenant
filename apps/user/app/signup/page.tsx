import Link from "next/link";
import { signupUser } from "../actions";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function SignupPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="shell hero">
      <section className="stack">
        <span className="badge">End User Signup</span>
        <h1>Join a tenant</h1>
        <p>
          End users belong to one organization. Their token contains that organization scope and the
          feature check form only asks for a feature key.
        </p>
        <p className="meta">
          Already registered? <Link href="/login">Login</Link>
        </p>
      </section>

      <form action={signupUser} className="card stack">
        <h2>Create end-user account</h2>
        {params.error ? <div className="error">{params.error}</div> : null}
        <label>
          Name
          <input name="name" autoComplete="name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="new-password" required />
        </label>
        <label>
          Organization slug
          <input name="organizationSlug" placeholder="acme-health" required />
        </label>
        <button type="submit">Create account</button>
      </form>
    </main>
  );
}
