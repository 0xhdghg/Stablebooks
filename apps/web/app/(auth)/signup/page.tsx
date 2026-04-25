import Link from "next/link";
import { redirect } from "next/navigation";
import { signupAction } from "../actions";
import { getOptionalSession } from "../../../lib/session";

export default async function SignupPage({
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
        <h1 className="page-title">Create your first finance ops workspace.</h1>
        <p className="page-copy">
          This milestone sets up your account, organization, and first Arc settlement wallet.
        </p>
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}
      <form action={signupAction} className="form-grid">
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" type="text" placeholder="Ada Builder" required />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="ada@stablebooks.test" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" placeholder="Choose a strong password" required />
        </div>
        <div className="actions">
          <button className="button" type="submit">
            Create account
          </button>
        </div>
      </form>
      <p className="footer-link">
        Already have an account? <Link href="/signin">Sign in</Link>
      </p>
    </div>
  );
}
