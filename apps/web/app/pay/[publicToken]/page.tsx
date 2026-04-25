import { notFound } from "next/navigation";
import { getPublicInvoice } from "../../../lib/api";
import { startPaymentSessionAction } from "../actions";

export default async function HostedInvoicePage({
  params
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;

  try {
    const invoice = await getPublicInvoice(publicToken);
    const isSettled =
      invoice.status === "paid" || invoice.paymentStatus === "finalized";

    return (
      <main className="public-shell">
        <section className="public-card">
          <p className="brand-mark">Stablebooks Pay</p>
          <h1 className="page-title">Invoice {invoice.referenceCode}</h1>
          <p className="page-copy">
            Pay a stablecoin invoice that settles into the recipient&apos;s Arc treasury flow.
          </p>

          <div className="public-summary">
            <div className="summary-card">
              <h2>Amount due</h2>
              <p className="hero-amount">{formatMoney(invoice.amountMinor, invoice.currency)}</p>
              <p className="inline-note">Customer: {invoice.customerName}</p>
            </div>
            <div className="summary-card">
              <h2>Invoice details</h2>
              <ul className="summary-list">
                <li>
                  <strong>Reference</strong>
                  <span>{invoice.referenceCode}</span>
                </li>
                <li>
                  <strong>Status</strong>
                  <span>{invoice.status}</span>
                </li>
                <li>
                  <strong>Due date</strong>
                  <span>{new Date(invoice.dueAt).toLocaleDateString()}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="info-card">
            <h2>Memo</h2>
            <p>{invoice.memo}</p>
          </div>

          {isSettled ? (
            <div className="success-banner" style={{ marginTop: "20px" }}>
              Payment complete. This invoice has already reached final settlement.
            </div>
          ) : (
            <form action={startPaymentSessionAction} className="actions" style={{ marginTop: "20px" }}>
              <input type="hidden" name="publicToken" value={publicToken} />
              <button className="button" type="submit">
                Simulate stablecoin payment
              </button>
            </form>
          )}
        </section>
      </main>
    );
  } catch {
    notFound();
  }
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}
