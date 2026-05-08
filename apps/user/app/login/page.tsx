import Link from "next/link";
import { loginUser } from "../actions";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="shell hero">
      <section className="stack">
        <span className="badge">End User</span>
        <h1>Check your features</h1>
        <p>
          Login once, then submit only a feature key. The backend evaluates the flag against your
          organization, not against a tenant id typed into the browser.
        </p>
        <p className="meta">
          Need an account? <Link href="/signup">Sign up</Link> · Quick demo?{" "}
          <Link href="/public-check">Use public checker</Link>
        </p>
      </section>

      <form action={loginUser} className="card stack">
        <h2>Login</h2>
        {params.error ? <div className="error">{params.error}</div> : null}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" placeholder="user@acme.test" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Continue</button>
      </form>
    </main>
  );
}
