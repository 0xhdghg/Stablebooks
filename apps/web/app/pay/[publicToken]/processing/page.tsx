import { notFound, redirect } from "next/navigation";
import { getPublicInvoice, getPublicInvoiceStatus } from "../../../../lib/api";
import { PublicPaymentPoller } from "../../../../components/public-payment-poller";

export default async function PaymentProcessingPage({
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

    if (status.redirectHint === "success") {
      redirect(`/pay/${publicToken}/success`);
    }

    return (
      <main className="public-shell">
        <PublicPaymentPoller publicToken={publicToken} />
        <section className="public-card">
          <p className="brand-mark">Settlement in progress</p>
          <h1 className="page-title">Finalizing invoice {invoice.referenceCode}</h1>
          <p className="page-copy">
            Your payment session has started and is now waiting for an explicit backend settlement
            confirmation. The invoice will not move to paid until that transition happens.
          </p>

          <div className="processing-steps">
            <div className="step step-done">Payment session created</div>
            <div className="step step-live">Waiting for settlement confirmation</div>
            <div className="step">Invoice marked paid</div>
          </div>

          <div className="summary-card">
            <h2>Current status</h2>
            <ul className="summary-list">
              <li>
                <strong>Invoice</strong>
                <span>{status.invoiceStatus}</span>
              </li>
              <li>
                <strong>Payment</strong>
                <span>{status.paymentStatus ?? "not started"}</span>
              </li>
              <li>
                <strong>Amount</strong>
                <span>{formatMoney(invoice.amountMinor, invoice.currency)}</span>
              </li>
            </ul>
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
