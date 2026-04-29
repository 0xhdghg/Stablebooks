import Link from "next/link";
import { redirect } from "next/navigation";
import { getPublicInvoice, getPublicInvoiceStatus } from "../../../../lib/api";

export default async function PaymentSuccessPage({
  params
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;
  const invoice = await getPublicInvoice(publicToken).catch(() => null);
  const status = await getPublicInvoiceStatus(publicToken).catch(() => null);

  if (!invoice || !status) {
    return <PaymentRouteIssue publicToken={publicToken} />;
  }

  if (status.redirectHint === "processing") {
    redirect(`/pay/${publicToken}/processing`);
  }

  if (status.redirectHint === "issue") {
    redirect(`/pay/${publicToken}/issue`);
  }

  if (status.redirectHint !== "success") {
    redirect(`/pay/${publicToken}`);
  }

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
}

function PaymentRouteIssue({ publicToken }: { publicToken: string }) {
  return (
    <main className="public-shell">
      <section className="public-card">
        <p className="brand-mark">Payment issue</p>
        <h1 className="page-title">We could not load this hosted payment receipt.</h1>
        <p className="page-copy">
          This usually means the public invoice token is invalid or the payment page is temporarily
          unavailable.
        </p>
        <div className="actions" style={{ marginTop: "20px" }}>
          <Link className="button" href={`/pay/${publicToken}`}>
            Try again
          </Link>
        </div>
      </section>
    </main>
  );
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}
