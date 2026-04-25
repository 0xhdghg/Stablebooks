import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalSession, getSessionToken } from "../../../lib/session";
import { listInvoices } from "../../../lib/api";

export default async function InvoicesPage() {
  const session = await getOptionalSession();
  if (!session) {
    redirect("/signin");
  }

  const token = await getSessionToken();
  if (!token) {
    redirect("/signin");
  }

  const invoices = await listInvoices(token);

  return (
    <div className="page-grid">
      <section className="dashboard-card span-two">
        <div className="section-head">
          <div>
            <p className="kicker">Invoices</p>
            <h2>The first receivables loop is live.</h2>
            <p className="section-copy">
              Create invoices against stored customers and inspect them through a proper detail view.
            </p>
          </div>
          <Link className="button" href="/invoices/new">
            Create invoice
          </Link>
        </div>
      </section>

      <section className="dashboard-card span-two">
        {invoices.length === 0 ? (
          <p className="empty-copy">
            No invoices yet. Create the first one and we can move straight into payment-state work in
            the next milestone.
          </p>
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Latest payment</th>
                  <th>Amount</th>
                  <th>Due date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <Link className="table-link" href={`/invoices/${invoice.id}`}>
                        {invoice.referenceCode}
                      </Link>
                    </td>
                    <td>{invoice.customerName}</td>
                    <td>
                      <span className="pill">{invoice.status}</span>
                    </td>
                    <td>
                      <span className="pill muted-pill">
                        {invoice.latestPaymentStatus ?? "none"}
                      </span>
                    </td>
                    <td>{formatMoney(invoice.amountMinor, invoice.currency)}</td>
                    <td>{new Date(invoice.dueAt).toLocaleDateString()}</td>
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

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}
