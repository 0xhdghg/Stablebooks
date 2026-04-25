import { notFound } from "next/navigation";
import { getPublicInvoice, getPublicInvoiceStatus } from "../../../../lib/api";

export default async function PaymentSuccessPage({
  params
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;

  try {
    const [invoice, status] = await Promise.all([
      getPublicInvoice(publicToken),
      getPublicInvoiceStatus(publicToken)
    ]);

    return (
      <main className="public-shell">
        <section className="public-card">
          <p className="brand-mark">Payment complete</p>
          <h1 className="page-title">Invoice {invoice.referenceCode} is settled.</h1>
          <p className="page-copy">
            The hosted payment flow reached final state and the invoice is now marked paid.
          </p>

          <div className="success-banner" style={{ marginBottom: "20px" }}>
            Stablebooks confirmed payment of {formatMoney(status.amountPaidMinor, invoice.currency)}.
          </div>

          <div className="public-summary">
            <div className="summary-card">
              <h2>Receipt</h2>
              <ul className="summary-list">
                <li>
                  <strong>Reference</strong>
                  <span>{invoice.referenceCode}</span>
                </li>
                <li>
                  <strong>Customer</strong>
                  <span>{invoice.customerName}</span>
                </li>
                <li>
                  <strong>Status</strong>
                  <span>{status.invoiceStatus}</span>
                </li>
              </ul>
            </div>
            <div className="summary-card">
              <h2>Memo</h2>
              <p>{invoice.memo}</p>
            </div>
          </div>
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
