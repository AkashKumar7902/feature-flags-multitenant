import Link from "next/link";
import { loginAdmin } from "../actions";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="shell hero">
      <section className="stack">
        <span className="badge">Organization Admin</span>
        <h1>Manage tenant flags</h1>
        <p>
          Create, update, and delete feature flags. Every request is scoped by the organization in
          your token, so an admin cannot mutate another tenant’s flags.
        </p>
        <p className="meta">
          Need an account? <Link href="/signup">Sign up with an invite code</Link>
        </p>
      </section>

      <form action={loginAdmin} className="card stack">
        <h2>Login</h2>
        {params.error ? <div className="error">{params.error}</div> : null}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" placeholder="admin@acme.test" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Open admin workspace</button>
      </form>
    </main>
  );
}
