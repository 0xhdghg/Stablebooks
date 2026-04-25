import Link from "next/link";
import { redirect } from "next/navigation";
import {
  failPaymentAction,
  finalizePaymentAction,
  replayPaymentWebhookAction,
  retryWebhookDeliveryAction
} from "../../actions";
import { getPayment } from "../../../../lib/api";
import { getOptionalSession, getSessionToken } from "../../../../lib/session";

export default async function PaymentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await getOptionalSession();
  if (!session) {
    redirect("/signin");
  }

  const token = await getSessionToken();
  if (!token) {
    redirect("/signin");
  }

  const { paymentId } = await params;
  const payment = await getPayment(token, paymentId);
  const paramsData = await searchParams;
  const latestDelivery = payment.webhookDeliveries?.[0] ?? null;

  return (
    <div className="page-grid">
      <section className="dashboard-card span-two">
        {paramsData.error ? <div className="alert" style={{ marginBottom: "18px" }}>{paramsData.error}</div> : null}
        {paramsData.success ? (
          <div className="success-banner" style={{ marginBottom: "18px" }}>
            {renderSuccessMessage(paramsData.success)}
          </div>
        ) : null}
        <div className="section-head">
          <div>
            <p className="kicker">Payment detail</p>
            <h2>{payment.id}</h2>
          </div>
          <span className="pill">{payment.status}</span>
        </div>
        <p className="section-copy">
          This is the deepest operator audit surface for a settlement attempt: match result,
          observation, confirmation fields, and downstream webhook deliveries all in one place.
        </p>
      </section>

      <section className="dashboard-card">
        <p className="kicker">Settlement summary</p>
        <h2>{formatMoney(payment.amountMinor, payment.currency)}</h2>
        <ul className="metric-list">
          <li>
            <strong>Match result</strong>
            <span>{payment.paymentMatch?.matchResult ?? payment.matchResult}</span>
          </li>
          <li>
            <strong>Match reason</strong>
            <span>{payment.paymentMatch?.matchReason ?? payment.matchReason ?? "No match explanation yet"}</span>
          </li>
          <li>
            <strong>Started</strong>
            <span>{formatDateTime(payment.startedAt)}</span>
          </li>
          <li>
            <strong>Processing started</strong>
            <span>{formatDateTime(payment.processingStartedAt)}</span>
          </li>
          <li>
            <strong>Confirmed at</strong>
            <span>{formatDateTime(payment.confirmedAt)}</span>
          </li>
          <li>
            <strong>Finalized at</strong>
            <span>{formatDateTime(payment.finalizedAt)}</span>
          </li>
        </ul>
      </section>

      <section className="dashboard-card">
        <p className="kicker">Invoice linkage</p>
        <h2>{payment.invoiceId}</h2>
        <ul className="metric-list">
          <li>
            <strong>Invoice</strong>
            <span>
              <Link className="table-link" href={`/invoices/${payment.invoiceId}`}>
                Open invoice detail
              </Link>
            </span>
          </li>
          <li>
            <strong>Public token</strong>
            <span>{payment.publicToken}</span>
          </li>
          <li>
            <strong>Failure reason</strong>
            <span>{payment.failureReason ?? "No failure recorded"}</span>
          </li>
          <li>
            <strong>Settlement reference</strong>
            <span>{payment.settlementReference ?? "Not assigned"}</span>
          </li>
        </ul>
      </section>

      <section className="dashboard-card">
        <p className="kicker">Provider source</p>
        <h2>{formatProviderTitle(payment.providerDiagnostic)}</h2>
        {payment.providerDiagnostic ? (
          <ul className="metric-list">
            <li>
              <strong>Boundary</strong>
              <span>{payment.providerDiagnostic.boundaryKind}</span>
            </li>
            <li>
              <strong>Source kind</strong>
              <span>{payment.providerDiagnostic.sourceKind}</span>
            </li>
            <li>
              <strong>Profile matched</strong>
              <span>{formatProfileMatch(payment.providerDiagnostic.sourceProfileMatched)}</span>
            </li>
            <li>
              <strong>Warnings</strong>
              <span>{formatWarnings(payment.providerDiagnostic.providerWarnings)}</span>
            </li>
          </ul>
        ) : (
          <p className="empty-copy">
            Provider diagnostics will appear after an Arc/Circle observation is attached.
          </p>
        )}
      </section>

      <section className="dashboard-card span-two">
        <p className="kicker">Onchain observation</p>
        <h2>{payment.observation ? payment.observation.status : "No observation yet"}</h2>
        {payment.observation ? (
          <div className="table-shell">
            <table className="data-table">
              <tbody>
                <tr>
                  <th>Transaction hash</th>
                  <td>{payment.observation.txHash}</td>
                </tr>
                <tr>
                  <th>Raw chain event</th>
                  <td>{payment.observation.rawChainEventId ?? "Not linked"}</td>
                </tr>
                <tr>
                  <th>Log index</th>
                  <td>{payment.observation.logIndex}</td>
                </tr>
                <tr>
                  <th>Block number</th>
                  <td>{payment.observation.blockNumber}</td>
                </tr>
                <tr>
                  <th>From</th>
                  <td>{payment.observation.fromAddress}</td>
                </tr>
                <tr>
                  <th>To</th>
                  <td>{payment.observation.toAddress}</td>
                </tr>
                <tr>
                  <th>Token</th>
                  <td>{payment.observation.token}</td>
                </tr>
                <tr>
                  <th>Amount</th>
                  <td>{formatAtomic(payment.observation.amountAtomic, payment.observation.decimals)}</td>
                </tr>
                <tr>
                  <th>Decimals</th>
                  <td>{payment.observation.decimals}</td>
                </tr>
                <tr>
                  <th>Chain ID</th>
                  <td>{payment.observation.chainId}</td>
                </tr>
                <tr>
                  <th>Observed at</th>
                  <td>{formatDateTime(payment.observation.observedAt)}</td>
                </tr>
                <tr>
                  <th>Chain source confirmed at</th>
                  <td>{formatDateTime(payment.observation.sourceConfirmedAt)}</td>
                </tr>
                <tr>
                  <th>Stablebooks observation confirmed at</th>
                  <td>{formatDateTime(payment.observation.confirmedAt)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-copy">
            This payment has not been linked to a normalized chain observation yet.
          </p>
        )}
      </section>

      <section className="dashboard-card">
        <p className="kicker">Confirmation fields</p>
        <h2>{payment.confirmationSource ?? "No terminal confirmation yet"}</h2>
        <ul className="metric-list">
          <li>
            <strong>txHash</strong>
            <span>{payment.txHash ?? payment.confirmationTxHash ?? "Not attached yet"}</span>
          </li>
          <li>
            <strong>blockNumber</strong>
            <span>
              {payment.blockNumber ?? payment.confirmationBlockNumber ?? "Not attached yet"}
            </span>
          </li>
          <li>
            <strong>Token</strong>
            <span>{payment.token ?? "Unknown"}</span>
          </li>
          <li>
            <strong>Atomic amount</strong>
            <span>{payment.amountAtomic ?? "Unknown"}</span>
          </li>
          <li>
            <strong>Decimals</strong>
            <span>{payment.decimals ?? "Unknown"}</span>
          </li>
          <li>
            <strong>Stablebooks confirmation received at</strong>
            <span>{formatDateTime(payment.confirmationReceivedAt)}</span>
          </li>
          <li>
            <strong>Chain source confirmed at</strong>
            <span>{formatDateTime(payment.sourceConfirmedAt)}</span>
          </li>
          <li>
            <strong>Stablebooks terminal confirmed at</strong>
            <span>{formatDateTime(payment.confirmedAt)}</span>
          </li>
        </ul>
      </section>

      <section className="dashboard-card">
        <p className="kicker">Latest webhook</p>
        <h2>{latestDelivery?.status ?? "No delivery recorded yet"}</h2>
        {latestDelivery ? (
          <>
            {latestDelivery.diagnostic ? (
              <div className={`delivery-diagnostic ${latestDelivery.diagnostic.severity}`}>
                <strong>{latestDelivery.diagnostic.label}</strong>
                <span>{latestDelivery.diagnostic.detail}</span>
                {latestDelivery.diagnostic.nextAction ? (
                  <span>{latestDelivery.diagnostic.nextAction}</span>
                ) : null}
              </div>
            ) : null}
            <ul className="metric-list">
              <li>
                <strong>Event</strong>
                <span>{latestDelivery.eventType}</span>
              </li>
              <li>
                <strong>Event ID</strong>
                <span>{latestDelivery.eventId}</span>
              </li>
              <li>
                <strong>Snapshot</strong>
                <span>
                  {latestDelivery.paymentStatusSnapshot} / {latestDelivery.invoiceStatusSnapshot}
                </span>
              </li>
              <li>
                <strong>Destination</strong>
                <span>{latestDelivery.destination ?? "No destination configured"}</span>
              </li>
              <li>
                <strong>HTTP status</strong>
                <span>{latestDelivery.responseStatus ?? "n/a"}</span>
              </li>
              <li>
                <strong>Next retry</strong>
                <span>{formatDateTime(latestDelivery.nextAttemptAt)}</span>
              </li>
              <li>
                <strong>Replay source</strong>
                <span>{latestDelivery.replayOfDeliveryId ?? "Original delivery"}</span>
              </li>
            </ul>
          </>
        ) : (
          <p className="empty-copy">
            A delivery record will appear here after a terminal payment outcome.
          </p>
        )}
        {latestDelivery ? (
          <div className="actions" style={{ marginTop: "18px" }}>
            <form action={retryWebhookDeliveryAction}>
              <input type="hidden" name="deliveryId" value={latestDelivery.id} />
              <input type="hidden" name="invoiceId" value={payment.invoiceId} />
              <input type="hidden" name="redirectTo" value={`/payments/${payment.id}`} />
              <button className="ghost-button" type="submit" disabled={latestDelivery.status === "delivered"}>
                Retry latest delivery
              </button>
            </form>
            {payment.status !== "pending" ? (
              <form action={replayPaymentWebhookAction}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <input type="hidden" name="invoiceId" value={payment.invoiceId} />
                <input type="hidden" name="redirectTo" value={`/payments/${payment.id}`} />
                <button className="button" type="submit">
                  Replay webhook event
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="dashboard-card span-two">
        <p className="kicker">Operator actions</p>
        <h2>Manual terminal transitions</h2>
        <p className="section-copy">
          These actions remain available for development and debugging while the settlement
          backend continues moving closer to the final production path.
        </p>
        {payment.status !== "finalized" && payment.status !== "failed" ? (
          <div className="page-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <form action={finalizePaymentAction} className="form-grid">
              <input type="hidden" name="paymentId" value={payment.id} />
              <input type="hidden" name="invoiceId" value={payment.invoiceId} />
              <div className="field">
                <label htmlFor="settlementReference">Settlement reference</label>
                <input
                  id="settlementReference"
                  name="settlementReference"
                  type="text"
                  placeholder="arc_settle_001"
                />
              </div>
              <div className="actions">
                <button className="button" type="submit">
                  Finalize payment
                </button>
              </div>
            </form>

            <form action={failPaymentAction} className="form-grid">
              <input type="hidden" name="paymentId" value={payment.id} />
              <input type="hidden" name="invoiceId" value={payment.invoiceId} />
              <div className="field">
                <label htmlFor="failureReason">Failure reason</label>
                <input
                  id="failureReason"
                  name="failureReason"
                  type="text"
                  placeholder="Settlement validation failed"
                />
              </div>
              <div className="actions">
                <button className="ghost-button" type="submit">
                  Mark payment failed
                </button>
              </div>
            </form>
          </div>
        ) : (
          <p className="empty-copy">This payment already reached a terminal state.</p>
        )}
      </section>

      <section className="dashboard-card span-two">
        <p className="kicker">Payment timeline</p>
        <h2>Event log</h2>
        {payment.events.length ? (
          <ul className="timeline-list">
            {payment.events.map((entry) => (
              <li key={entry.id} className="timeline-item">
                <div className="timeline-dot" />
                <div>
                  <strong>{entry.type}</strong>
                  <p>{entry.note}</p>
                  <span className="timeline-time">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">No timeline events yet.</p>
        )}
      </section>
    </div>
  );
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}

function formatAtomic(amountAtomic: string, decimals: number) {
  const padded = amountAtomic.padStart(decimals + 1, "0");
  const integer = padded.slice(0, Math.max(1, padded.length - decimals));
  const fraction = padded.slice(Math.max(1, padded.length - decimals)).replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not available";
}

function formatProviderTitle(
  diagnostic: {
    boundaryKind: "canonical" | "circle_event_monitor";
    sourceProfileMatched: boolean | null;
  } | null | undefined
) {
  if (!diagnostic) {
    return "No provider signal yet";
  }

  if (diagnostic.boundaryKind === "circle_event_monitor") {
    return diagnostic.sourceProfileMatched
      ? "Circle/Event Monitor verified"
      : "Circle/Event Monitor pending review";
  }

  return "Canonical/dev ingest";
}

function formatProfileMatch(value: boolean | null) {
  if (value === true) {
    return "Matched expected provider profile";
  }

  if (value === false) {
    return "Rejected before matching";
  }

  return "Not applicable for this path";
}

function formatWarnings(warnings: string[]) {
  return warnings.length ? warnings.join(", ") : "No provider warnings";
}

function renderSuccessMessage(code: string) {
  if (code === "payment-failed") {
    return "Payment marked failed and invoice reopened for another collection attempt.";
  }

  if (code === "webhook-retried") {
    return "Webhook delivery retried.";
  }

  if (code === "webhook-replayed") {
    return "Webhook event replayed as a fresh outbound delivery.";
  }

  return "Payment finalized and invoice marked paid.";
}
