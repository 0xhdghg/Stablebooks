import Link from "next/link";
import { redirect } from "next/navigation";
import { signinAction } from "../actions";
import { getOptionalSession } from "../../../lib/session";

export default async function SigninPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getOptionalSession();
  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <div className="stack">
      <div>
        <p className="brand-mark">Stablebooks</p>
        <h1 className="page-title">Sign in to your treasury workspace.</h1>
        <p className="page-copy">
          Enter your account details to continue into the Arc-native receivables flow.
        </p>
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}
      <form action={signinAction} className="form-grid">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="finance@stablebooks.test" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" placeholder="At least 8 characters" required />
        </div>
        <div className="actions">
          <button className="button" type="submit">
            Sign in
          </button>
        </div>
      </form>
      <p className="footer-link">
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </div>
  );
}
