import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomer } from "../../../../lib/api";
import { getOptionalSession, getSessionToken } from "../../../../lib/session";

export default async function CustomerDetailPage({
  params
}: {
  params: Promise<{ customerId: string }>;
}) {
  const session = await getOptionalSession();
  if (!session) {
    redirect("/signin");
  }

  const token = await getSessionToken();
  if (!token) {
    redirect("/signin");
  }

  const { customerId } = await params;
  const customer = await getCustomer(token, customerId);

  return (
    <div className="page-grid">
      <section className="dashboard-card span-two">
        <p className="kicker">Customer detail</p>
        <h2>{customer.name}</h2>
        <ul className="metric-list">
          <li>
            <strong>Email</strong>
            <span>{customer.email}</span>
          </li>
          <li>
            <strong>Billing currency</strong>
            <span>{customer.billingCurrency}</span>
          </li>
          <li>
            <strong>Invoice count</strong>
            <span>{customer.invoices?.length ?? 0}</span>
          </li>
        </ul>
      </section>

      <section className="dashboard-card span-two">
        <div className="section-head">
          <div>
            <p className="kicker">Invoices</p>
            <h2>All invoices for this customer</h2>
          </div>
          <Link className="ghost-button" href="/invoices/new">
            New invoice
          </Link>
        </div>

        {!customer.invoices || customer.invoices.length === 0 ? (
          <p className="empty-copy">No invoices yet for this customer.</p>
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {customer.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <Link className="table-link" href={`/invoices/${invoice.id}`}>
                        {invoice.referenceCode}
                      </Link>
                    </td>
                    <td>
                      <span className="pill">{invoice.status}</span>
                    </td>
                    <td>
                      {formatMoney(invoice.amountMinor, invoice.currency)}
                    </td>
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
