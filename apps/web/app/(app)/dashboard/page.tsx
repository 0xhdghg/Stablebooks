import { redirect } from "next/navigation";
import Link from "next/link";
import { getRuntimeReadiness } from "../../../lib/api";
import { getOptionalSession } from "../../../lib/session";

export default async function DashboardPage() {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/signin");
  }

  const runtime = await getRuntimeReadiness().catch(() => null);
  const defaultWallet = session.wallets.find((wallet) => wallet.isDefaultSettlement) ?? null;

  return (
    <div className="dashboard-grid">
      <section className="dashboard-card">
        <p className="kicker">Workspace status</p>
        <h2>Hosted workspace is active.</h2>
        <p>
          Stablebooks is now running as a hosted Railway staging stack with Postgres-backed
          payment state, auth runtime, and operator rehearsal automation.
        </p>
      </section>
      <section className="dashboard-card">
        <p className="kicker">Operator context</p>
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
            <strong>Default settlement wallet</strong>
            <span>{defaultWallet?.address ?? "Not configured"}</span>
          </li>
          <li>
            <strong>Wallet count</strong>
            <span>{session.wallets.length}</span>
          </li>
        </ul>
      </section>
      <section className="dashboard-card">
        <p className="kicker">Runtime readiness</p>
        <h2>
          {runtime?.storage.hostedRuntimePolicy.policyOk &&
          runtime?.storage.postgresBackedRuntimeReady &&
          runtime?.arc.ready
            ? "Hosted policy and provider posture look healthy."
            : "Runtime needs operator attention."}
        </h2>
        {runtime ? (
          <ul className="metric-list">
            <li>
              <strong>Storage mode</strong>
              <span>{runtime.storage.storageMode}</span>
            </li>
            <li>
              <strong>Hosted policy</strong>
              <span>
                {runtime.storage.hostedRuntimePolicy.policyOk
                  ? `ok (${runtime.storage.hostedRuntimePolicy.platform ?? "hosted"})`
                  : "degraded"}
              </span>
            </li>
            <li>
              <strong>Arc source</strong>
              <span>
                {runtime.arc.ready
                  ? `${runtime.arc.config.sourceKind} / chain ${runtime.arc.config.chainId ?? "n/a"}`
                  : `missing: ${runtime.arc.missing.join(", ")}`}
              </span>
            </li>
            <li>
              <strong>Outbound webhook</strong>
              <span>
                {runtime.outboundWebhook.configured
                  ? `configured (${runtime.outboundWebhook.destinationHost ?? "custom host"})`
                  : "disabled"}
              </span>
            </li>
          </ul>
        ) : (
          <p>Runtime readiness could not be loaded from the API.</p>
        )}
      </section>
      <section className="checklist">
        <p className="kicker">Operator checklist</p>
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
              <p>Route guarding and hosted operator flow are wired end-to-end.</p>
            </div>
          </li>
          <li className="check-item">
            <span
              className={`dot ${
                runtime?.storage.postgresBackedRuntimeReady &&
                runtime?.storage.hostedRuntimePolicy.policyOk
                  ? "is-done"
                  : ""
              }`}
            />
            <div>
              <strong>Postgres-backed hosted runtime</strong>
              <p>
                {runtime
                  ? runtime.storage.postgresBackedRuntimeReady
                    ? "Runtime reads and writes are aligned on Postgres."
                    : "Runtime is not fully Postgres-backed."
                  : "Runtime readiness unavailable."}
              </p>
            </div>
          </li>
        </ul>
      </section>
      <section className="info-card">
        <p className="kicker">What comes next</p>
        <h2>We are in final MVP hardening.</h2>
        <p>
          The core hosted payment flow is already working. The remaining work is around
          observability, operator clarity, and the last launch-readiness checks before calling the
          MVP ready.
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
