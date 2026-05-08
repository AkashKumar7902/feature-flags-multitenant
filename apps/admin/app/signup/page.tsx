import Link from "next/link";
import { signupAdmin } from "../actions";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function SignupPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="shell hero">
      <section className="stack">
        <span className="badge">Admin Signup</span>
        <h1>Join your organization</h1>
        <p>
          Ask the Super Admin for your organization slug and admin invite code. The invite is hashed
          in PostgreSQL; the plaintext code is only shown when it is created or rotated.
        </p>
        <p className="meta">
          Already registered? <Link href="/login">Login</Link>
        </p>
      </section>

      <form action={signupAdmin} className="card stack">
        <h2>Create admin account</h2>
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
        <label>
          Admin invite code
          <input name="inviteCode" required />
        </label>
        <button type="submit">Create account</button>
      </form>
    </main>
  );
}
