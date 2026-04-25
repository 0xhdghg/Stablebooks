import Link from "next/link";
import { redirect } from "next/navigation";
import {
  failPaymentAction,
  finalizePaymentAction,
  replayPaymentWebhookAction,
  retryWebhookDeliveryAction
} from "../../actions";
import { getInvoice } from "../../../../lib/api";
import { getOptionalSession, getSessionToken } from "../../../../lib/session";

export default async function InvoiceDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ invoiceId: string }>;
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

  const { invoiceId } = await params;
  const invoice = await getInvoice(token, invoiceId);
  const paramsData = await searchParams;
  const latestPayment = invoice.payments?.[0] ?? null;
  const latestDelivery = latestPayment?.webhookDeliveries?.[0] ?? null;

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
            <p className="kicker">Invoice detail</p>
            <h2>{invoice.referenceCode}</h2>
          </div>
          <span className="pill">{invoice.status}</span>
        </div>
        <p className="section-copy">
          This invoice now surfaces the full settlement picture: payment match state, normalized
          chain observation, confirmation fields, and downstream webhook delivery health.
        </p>
      </section>

      <section className="dashboard-card">
        <p className="kicker">Amount</p>
        <h2>{formatMoney(invoice.amountMinor, invoice.currency)}</h2>
        <ul className="metric-list">
          <li>
            <strong>Currency</strong>
            <span>{invoice.currency}</span>
          </li>
          <li>
            <strong>Due date</strong>
            <span>{new Date(invoice.dueAt).toLocaleDateString()}</span>
          </li>
          <li>
            <strong>Created</strong>
            <span>{new Date(invoice.createdAt).toLocaleString()}</span>
          </li>
          <li>
            <strong>Published at</strong>
            <span>{formatDateTime(invoice.publishedAt)}</span>
          </li>
        </ul>
      </section>

      <section className="dashboard-card">
        <p className="kicker">Customer</p>
        <h2>{invoice.customer?.name ?? invoice.customerName}</h2>
        <ul className="metric-list">
          <li>
            <strong>Email</strong>
            <span>{invoice.customer?.email ?? "Unknown"}</span>
          </li>
          <li>
            <strong>Billing currency</strong>
            <span>{invoice.customer?.billingCurrency ?? invoice.currency}</span>
          </li>
          <li>
            <strong>Profile</strong>
            <span>
              {invoice.customer ? (
                <Link className="table-link" href={`/customers/${invoice.customer.id}`}>
                  Open customer record
                </Link>
              ) : (
                "Unavailable"
              )}
            </span>
          </li>
        </ul>
      </section>

      <section className="dashboard-card span-two">
        <p className="kicker">Invoice content</p>
        <h2>Commercial fields</h2>
        <ul className="metric-list">
          <li>
            <strong>Memo</strong>
            <span>{invoice.memo}</span>
          </li>
          <li>
            <strong>Internal note</strong>
            <span>{invoice.internalNote || "No internal note"}</span>
          </li>
          <li>
            <strong>Public token</strong>
            <span>{invoice.publicToken}</span>
          </li>
          <li>
            <strong>Hosted payment page</strong>
            <span>
              <Link className="table-link" href={`/pay/${invoice.publicToken}`}>
                Open hosted invoice
              </Link>
            </span>
          </li>
        </ul>
      </section>

      <section className="dashboard-card">
        <p className="kicker">Latest payment</p>
        <h2>{latestPayment ? latestPayment.status : "No payment session yet"}</h2>
        {latestPayment ? (
          <>
            <ul className="metric-list">
              <li>
                <strong>Match result</strong>
                <span>{latestPayment.paymentMatch?.matchResult ?? latestPayment.matchResult}</span>
              </li>
              <li>
                <strong>Match reason</strong>
                <span>{latestPayment.paymentMatch?.matchReason ?? latestPayment.matchReason ?? "No match explanation yet"}</span>
              </li>
              <li>
                <strong>Started</strong>
                <span>{formatDateTime(latestPayment.startedAt)}</span>
              </li>
              <li>
                <strong>Processing started</strong>
                <span>{formatDateTime(latestPayment.processingStartedAt)}</span>
              </li>
              <li>
                <strong>Confirmed at</strong>
                <span>{formatDateTime(latestPayment.confirmedAt)}</span>
              </li>
              <li>
                <strong>Payment detail</strong>
                <span>
                  <Link className="table-link" href={`/payments/${latestPayment.id}`}>
                    Open payment detail
                  </Link>
                </span>
              </li>
            </ul>
            {latestPayment.status !== "finalized" && latestPayment.status !== "failed" ? (
              <div className="page-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: "18px" }}>
                <form action={finalizePaymentAction} className="form-grid">
                  <input type="hidden" name="paymentId" value={latestPayment.id} />
                  <input type="hidden" name="invoiceId" value={invoice.id} />
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
                  <input type="hidden" name="paymentId" value={latestPayment.id} />
                  <input type="hidden" name="invoiceId" value={invoice.id} />
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
            ) : null}
          </>
        ) : (
          <p className="empty-copy">
            No payment session has been started for this invoice yet.
          </p>
        )}
      </section>

      <section className="dashboard-card span-two">
        <p className="kicker">Settlement observation</p>
        <h2>{latestPayment?.observation ? latestPayment.observation.status : "No observation yet"}</h2>
        {latestPayment?.observation ? (
          <div className="table-shell">
            <table className="data-table">
              <tbody>
                <tr>
                  <th>txHash</th>
                  <td>{latestPayment.observation.txHash}</td>
                </tr>
                <tr>
                  <th>rawChainEventId</th>
                  <td>{latestPayment.observation.rawChainEventId ?? "Not linked"}</td>
                </tr>
                <tr>
                  <th>logIndex</th>
                  <td>{latestPayment.observation.logIndex}</td>
                </tr>
                <tr>
                  <th>blockNumber</th>
                  <td>{latestPayment.observation.blockNumber}</td>
                </tr>
                <tr>
                  <th>from</th>
                  <td>{latestPayment.observation.fromAddress}</td>
                </tr>
                <tr>
                  <th>to</th>
                  <td>{latestPayment.observation.toAddress}</td>
                </tr>
                <tr>
                  <th>token</th>
                  <td>{latestPayment.observation.token}</td>
                </tr>
                <tr>
                  <th>amount</th>
                  <td>{formatAtomic(latestPayment.observation.amountAtomic, latestPayment.observation.decimals)}</td>
                </tr>
                <tr>
                  <th>decimals</th>
                  <td>{latestPayment.observation.decimals}</td>
                </tr>
                <tr>
                  <th>chainId</th>
                  <td>{latestPayment.observation.chainId}</td>
                </tr>
                <tr>
                  <th>observedAt</th>
                  <td>{formatDateTime(latestPayment.observation.observedAt)}</td>
                </tr>
                <tr>
                  <th>chainSourceConfirmedAt</th>
                  <td>{formatDateTime(latestPayment.observation.sourceConfirmedAt)}</td>
                </tr>
                <tr>
                  <th>stablebooksObservationConfirmedAt</th>
                  <td>{formatDateTime(latestPayment.observation.confirmedAt)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-copy">
            This invoice has not been linked to a normalized onchain observation yet.
          </p>
        )}
      </section>

      <section className="dashboard-card">
        <p className="kicker">Confirmation snapshot</p>
        <h2>{latestPayment?.confirmationSource ?? "Awaiting terminal confirmation"}</h2>
        {latestPayment ? (
          <ul className="metric-list">
            <li>
              <strong>txHash</strong>
              <span>{latestPayment.txHash ?? latestPayment.confirmationTxHash ?? "Not attached yet"}</span>
            </li>
            <li>
              <strong>blockNumber</strong>
              <span>{latestPayment.blockNumber ?? latestPayment.confirmationBlockNumber ?? "Not attached yet"}</span>
            </li>
            <li>
              <strong>Token</strong>
              <span>{latestPayment.token ?? "Unknown"}</span>
            </li>
            <li>
              <strong>Atomic amount</strong>
              <span>{latestPayment.amountAtomic ?? "Unknown"}</span>
            </li>
            <li>
              <strong>Decimals</strong>
              <span>{latestPayment.decimals ?? "Unknown"}</span>
            </li>
            <li>
              <strong>Stablebooks confirmation received at</strong>
              <span>{formatDateTime(latestPayment.confirmationReceivedAt)}</span>
            </li>
            <li>
              <strong>Chain source confirmed at</strong>
              <span>{formatDateTime(latestPayment.sourceConfirmedAt)}</span>
            </li>
            <li>
              <strong>Stablebooks terminal confirmed at</strong>
              <span>{formatDateTime(latestPayment.confirmedAt)}</span>
            </li>
          </ul>
        ) : (
          <p className="empty-copy">No payment confirmation fields yet.</p>
        )}
      </section>

      <section className="dashboard-card">
        <p className="kicker">Provider source</p>
        <h2>{formatProviderTitle(latestPayment?.providerDiagnostic)}</h2>
        {latestPayment?.providerDiagnostic ? (
          <ul className="metric-list">
            <li>
              <strong>Boundary</strong>
              <span>{latestPayment.providerDiagnostic.boundaryKind}</span>
            </li>
            <li>
              <strong>Source kind</strong>
              <span>{latestPayment.providerDiagnostic.sourceKind}</span>
            </li>
            <li>
              <strong>Profile matched</strong>
              <span>{formatProfileMatch(latestPayment.providerDiagnostic.sourceProfileMatched)}</span>
            </li>
            <li>
              <strong>Warnings</strong>
              <span>{formatWarnings(latestPayment.providerDiagnostic.providerWarnings)}</span>
            </li>
          </ul>
        ) : (
          <p className="empty-copy">
            Provider diagnostics will appear after an Arc/Circle observation is attached.
          </p>
        )}
      </section>

      <section className="dashboard-card">
        <p className="kicker">Webhook delivery</p>
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
                <strong>Event type</strong>
                <span>{latestDelivery.eventType}</span>
              </li>
              <li>
                <strong>Event ID</strong>
                <span>{latestDelivery.eventId}</span>
              </li>
              <li>
                <strong>Outcome snapshot</strong>
                <span>
                  {latestDelivery.paymentStatusSnapshot} / {latestDelivery.invoiceStatusSnapshot}
                </span>
              </li>
              <li>
                <strong>Destination</strong>
                <span>{latestDelivery.destination ?? "No webhook URL configured"}</span>
              </li>
              <li>
                <strong>Attempts</strong>
                <span>{latestDelivery.attemptCount}/{latestDelivery.maxAttempts}</span>
              </li>
              <li>
                <strong>HTTP status</strong>
                <span>{latestDelivery.responseStatus ?? "n/a"}</span>
              </li>
              <li>
                <strong>Last error</strong>
                <span>{latestDelivery.errorMessage ?? "n/a"}</span>
              </li>
              <li>
                <strong>Next retry</strong>
                <span>{formatDateTime(latestDelivery.nextAttemptAt)}</span>
              </li>
              <li>
                <strong>Dead-lettered at</strong>
                <span>{formatDateTime(latestDelivery.deadLetteredAt)}</span>
              </li>
              <li>
                <strong>Replay source</strong>
                <span>{latestDelivery.replayOfDeliveryId ?? "Original delivery"}</span>
              </li>
            </ul>
            <div className="actions" style={{ marginTop: "18px" }}>
              <form action={retryWebhookDeliveryAction}>
                <input type="hidden" name="deliveryId" value={latestDelivery.id} />
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button className="ghost-button" type="submit" disabled={latestDelivery.status === "delivered"}>
                  Retry latest delivery
                </button>
              </form>
              {latestPayment && latestPayment.status !== "pending" ? (
                <form action={replayPaymentWebhookAction}>
                  <input type="hidden" name="paymentId" value={latestPayment.id} />
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <button className="button" type="submit">
                    Replay webhook event
                  </button>
                </form>
              ) : null}
            </div>
          </>
        ) : (
          <p className="empty-copy">
            Webhook delivery will appear here after settlement finalization or failure.
          </p>
        )}
      </section>

      <section className="dashboard-card span-two">
        <p className="kicker">Payment timeline</p>
        <h2>State transitions</h2>
        {invoice.timeline && invoice.timeline.length > 0 ? (
          <ul className="timeline-list">
            {invoice.timeline.map((entry) => (
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
