import { redirect } from "next/navigation";
import Link from "next/link";
import { getOptionalSession } from "../../../lib/session";

export default async function DashboardPage() {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/signin");
  }

  return (
    <div className="dashboard-grid">
      <section className="dashboard-card">
        <p className="kicker">Milestone 1 result</p>
        <h2>Protected workspace is active.</h2>
        <p>
          The app now supports sign up, sign in, organization setup, wallet setup, and a
          session-backed dashboard shell.
        </p>
      </section>
      <section className="dashboard-card">
        <p className="kicker">Workspace status</p>
        <ul className="metric-list">
          <li>
            <strong>User</strong>
            <span>{session.user.name}</span>
          </li>
          <li>
            <strong>Organization</strong>
            <span>{session.organization?.name ?? "Not configured"}</span>
          </li>
          <li>
            <strong>Wallet count</strong>
            <span>{session.wallets.length}</span>
          </li>
          <li>
            <strong>Next product move</strong>
            <span>Payment-state and hosted invoice flow</span>
          </li>
        </ul>
      </section>
      <section className="checklist">
        <p className="kicker">Onboarding checklist</p>
        <h2>What is complete right now</h2>
        <ul className="checklist-list">
          <li className="check-item">
            <span className={`dot ${session.onboarding.hasOrganization ? "is-done" : ""}`} />
            <div>
              <strong>Organization created</strong>
              <p>{session.organization?.name ?? "Waiting for org setup"}</p>
            </div>
          </li>
          <li className="check-item">
            <span
              className={`dot ${session.onboarding.hasDefaultSettlementWallet ? "is-done" : ""}`}
            />
            <div>
              <strong>Default settlement wallet configured</strong>
              <p>
                {session.wallets.find((wallet) => wallet.isDefaultSettlement)?.address ??
                  "Waiting for wallet setup"}
              </p>
            </div>
          </li>
          <li className="check-item">
            <span className="dot is-done" />
            <div>
              <strong>Protected app shell running</strong>
              <p>Route guarding and cookie-backed session lookup are wired.</p>
            </div>
          </li>
        </ul>
      </section>
      <section className="info-card">
        <p className="kicker">What comes next</p>
        <h2>Milestone 2 is now in place.</h2>
        <p>
          Customer records and invoice CRUD now sit on top of the session, organization, and wallet
          model. The next slice is payment-state and hosted invoice settlement flow.
        </p>
        <div className="actions" style={{ marginTop: "16px" }}>
          <Link className="button" href="/customers">
            Open customers
          </Link>
          <Link className="ghost-button" href="/invoices">
            Open invoices
          </Link>
        </div>
      </section>
    </div>
  );
}
