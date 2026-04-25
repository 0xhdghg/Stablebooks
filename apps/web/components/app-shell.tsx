import Link from "next/link";
import { ReactNode } from "react";
import { signoutAction } from "../app/(auth)/actions";
import { SessionPayload } from "../lib/api";
import { AppNav } from "./app-nav";

type AppShellProps = {
  session: SessionPayload;
  title: string;
  description: string;
  children: ReactNode;
};

export function AppShell({
  session,
  title,
  description,
  children
}: AppShellProps) {
  return (
    <div className="layout-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="brand-mark">Stablebooks</p>
          <h1>Finance ops for stablecoins.</h1>
          <p>
            Customer records, invoice operations, and payment webhook recovery now run inside the
            same secured workspace.
          </p>
        </div>
        <AppNav />
        <div className="sidebar-footer">
          <div className="summary-card">
            <h2>{session.organization?.name ?? "No organization yet"}</h2>
            <p className="inline-note">
              Signed in as <strong>{session.user.name}</strong>
            </p>
          </div>
          <form action={signoutAction}>
            <button className="ghost-button" type="submit">
              Sign out
            </button>
          </form>
          <Link className="ghost-button" href="/onboarding/wallets">
            Manage wallet
          </Link>
        </div>
      </aside>
      <div className="shell-main">
        <header className="shell-topbar">
          <div>
            <p className="kicker">Protected workspace</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="badge">Arc settlement onboarding ready</div>
        </header>
        <main className="content-area">{children}</main>
      </div>
    </div>
  );
}
