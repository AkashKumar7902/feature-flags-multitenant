import Link from "next/link";
import { loginSuperAdmin } from "../actions";

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="shell hero">
      <section className="stack">
        <span className="badge">Software Host Console</span>
        <h1>Super Admin</h1>
        <p>
          Create tenant organizations and issue one-time admin signup invites. Super Admin credentials
          are static and configured through environment variables, as required by the assignment.
        </p>
        <p className="meta">
          Other apps: <Link href="http://localhost:3001">Admin</Link> ·{" "}
          <Link href="http://localhost:3002">User</Link>
        </p>
      </section>

      <form action={loginSuperAdmin} className="card stack">
        <h2>Login</h2>
        {params.error ? <div className="error">{params.error}</div> : null}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" placeholder="super@byepo.local" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Enter console</button>
      </form>
    </main>
  );
}
