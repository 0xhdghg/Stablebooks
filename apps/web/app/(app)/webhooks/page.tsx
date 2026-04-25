import Link from "next/link";
import { redirect } from "next/navigation";
import { retryWebhookDeliveryAction } from "../actions";
import { listWebhookDeliveries } from "../../../lib/api";
import { getOptionalSession, getSessionToken } from "../../../lib/session";

export default async function WebhooksPage({
  searchParams
}: {
  searchParams: Promise<{
    queue?: "all" | "active" | "dead_letter";
    error?: string;
    success?: string;
  }>;
}) {
  const session = await getOptionalSession();
  if (!session) {
    redirect("/signin");
  }

  const token = await getSessionToken();
  if (!token) {
    redirect("/signin");
  }

  const params = await searchParams;
  const queue = params.queue ?? "all";
  const response = await listWebhookDeliveries(token, { queue });
  const deliveries = response.data;
  const meta = response.meta ?? {
    total: 0,
    active: 0,
    deadLetter: 0,
    disabled: 0,
    delivered: 0
  };

  return (
    <div className="page-grid">
      <section className="dashboard-card span-two">
        {params.error ? <div className="alert" style={{ marginBottom: "18px" }}>{params.error}</div> : null}
        {params.success ? (
          <div className="success-banner" style={{ marginBottom: "18px" }}>
            {renderSuccessMessage(params.success)}
          </div>
        ) : null}
        <div className="section-head">
          <div>
            <p className="kicker">Webhook operations</p>
            <h2>Deliveries and dead-letter queue</h2>
          </div>
          <span className="pill">{queue.replace("_", " ")}</span>
        </div>
        <p className="section-copy">
          This queue shows outbound payment webhooks, scheduled retries, disabled endpoints, and
          deliveries that exhausted automatic backoff and landed in dead-letter.
        </p>
        <div className="actions" style={{ marginTop: "18px" }}>
          <Link className="ghost-button" href="/webhooks?queue=all">
            All deliveries
          </Link>
          <Link className="ghost-button" href="/webhooks?queue=active">
            Retry queue
          </Link>
          <Link className="ghost-button" href="/webhooks?queue=dead_letter">
            Dead-letter queue
          </Link>
        </div>
      </section>

      <section className="dashboard-card">
        <p className="kicker">Total</p>
        <h2>{meta.total}</h2>
        <p className="empty-copy">Deliveries matching the current queue filter.</p>
      </section>

      <section className="dashboard-card">
        <p className="kicker">Active retries</p>
        <h2>{meta.active}</h2>
        <p className="empty-copy">Failed deliveries waiting for the next backoff window.</p>
      </section>

      <section className="dashboard-card">
        <p className="kicker">Dead-letter</p>
        <h2>{meta.deadLetter}</h2>
        <p className="empty-copy">Deliveries that exhausted automatic retry attempts.</p>
      </section>

      <section className="dashboard-card">
        <p className="kicker">Disabled</p>
        <h2>{meta.disabled}</h2>
        <p className="empty-copy">Skipped because no webhook destination is configured.</p>
      </section>

      <section className="dashboard-card span-two">
        <div className="section-head">
          <div>
            <p className="kicker">Queue detail</p>
            <h2>Recent deliveries</h2>
          </div>
        </div>
        {deliveries.length === 0 ? (
          <p className="empty-copy">
            No webhook deliveries match this filter yet.
          </p>
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Outcome</th>
                  <th>Attempts</th>
                  <th>Next retry</th>
                  <th>Destination</th>
                  <th>Invoice</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td>
                      <strong>{delivery.eventType}</strong>
                      <div className="inline-note">{shortId(delivery.eventId)}</div>
                      <div className="inline-note">payment {shortId(delivery.paymentId)}</div>
                    </td>
                    <td>
                      <span className={`pill ${delivery.status === "dead_letter" ? "muted-pill" : ""}`}>
                        {delivery.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div>{delivery.paymentStatusSnapshot} / {delivery.invoiceStatusSnapshot}</div>
                      <div className="inline-note">
                        {delivery.replayOfDeliveryId
                          ? `replay of ${shortId(delivery.replayOfDeliveryId)}`
                          : new Date(delivery.eventCreatedAt).toLocaleString()}
                      </div>
                      {delivery.diagnostic ? (
                        <div className={`delivery-diagnostic ${delivery.diagnostic.severity}`}>
                          <strong>{delivery.diagnostic.label}</strong>
                          <span>{delivery.diagnostic.detail}</span>
                          {delivery.diagnostic.nextAction ? (
                            <span>{delivery.diagnostic.nextAction}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {delivery.attemptCount}/{delivery.maxAttempts}
                    </td>
                    <td>
                      {delivery.nextAttemptAt
                        ? new Date(delivery.nextAttemptAt).toLocaleString()
                        : "No retry scheduled"}
                    </td>
                    <td>
                      <div>{delivery.destination ?? "No destination configured"}</div>
                      {delivery.responseStatus ? (
                        <div className="inline-note">HTTP {delivery.responseStatus}</div>
                      ) : null}
                      {delivery.errorMessage ? (
                        <div className="inline-note">{delivery.errorMessage}</div>
                      ) : null}
                    </td>
                    <td>
                      <Link className="table-link" href={`/invoices/${delivery.invoiceId}`}>
                        {shortId(delivery.invoiceId)}
                      </Link>
                    </td>
                    <td>
                      <Link className="table-link" href={`/payments/${delivery.paymentId}`}>
                        {shortId(delivery.paymentId)}
                      </Link>
                    </td>
                    <td>
                      <div className="actions">
                        <form action={retryWebhookDeliveryAction}>
                          <input type="hidden" name="deliveryId" value={delivery.id} />
                          <input type="hidden" name="invoiceId" value={delivery.invoiceId} />
                          <input type="hidden" name="redirectTo" value={`/webhooks?queue=${queue}`} />
                          <button className="ghost-button" type="submit">
                            Retry now
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function renderSuccessMessage(code: string) {
  if (code === "webhook-retried") {
    return "Webhook delivery retried.";
  }

  return "Webhook queue updated.";
}

function shortId(value: string) {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}
