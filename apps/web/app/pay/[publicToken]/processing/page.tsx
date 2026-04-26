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
            Send the exact USDC amount below from MetaMask. Stablebooks will watch Arc, match the
            transfer to this invoice, and move it to paid after confirmation.
          </p>

          <div className="processing-steps">
            <div className="step step-done">Payment session created</div>
            <div className="step step-live">Waiting for settlement confirmation</div>
            <div className="step">Invoice marked paid</div>
          </div>

          {invoice.settlementWallet ? (
            <div className="summary-card" style={{ marginBottom: "18px" }}>
              <h2>Send payment on Arc</h2>
              <ul className="summary-list">
                <li>
                  <strong>Network</strong>
                  <span>{formatChain(invoice.settlementWallet.chain)}</span>
                </li>
                <li>
                  <strong>Token</strong>
                  <span>USDC</span>
                </li>
                <li>
                  <strong>Exact amount</strong>
                  <span>{formatTokenAmount(invoice.amountMinor)} USDC</span>
                </li>
                <li>
                  <strong>Recipient wallet</strong>
                  <span className="address-text">{invoice.settlementWallet.address}</span>
                </li>
              </ul>
              <p className="inline-note" style={{ marginTop: "12px" }}>
                Use the same Arc Testnet network in MetaMask. A different amount may remain unmatched.
              </p>
            </div>
          ) : (
            <div className="alert" style={{ marginBottom: "18px" }}>
              Settlement wallet is missing, so this invoice cannot be paid yet.
            </div>
          )}

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

function formatTokenAmount(amountMinor: number) {
  return (amountMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
}

function formatChain(chain: string) {
  return chain.toLowerCase() === "arc" ? "Arc Testnet" : chain;
}
