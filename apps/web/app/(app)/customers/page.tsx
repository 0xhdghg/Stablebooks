import Link from "next/link";
import { redirect } from "next/navigation";
import { createCustomerAction } from "../actions";
import { getOptionalSession, getSessionToken } from "../../../lib/session";
import { listCustomers } from "../../../lib/api";

export default async function CustomersPage({
  searchParams
}: {
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

  const customers = await listCustomers(token);
  const params = await searchParams;

  return (
    <div className="page-grid">
      <section className="dashboard-card span-two">
        <p className="kicker">Customers</p>
        <h2>Store the counterparties you invoice repeatedly.</h2>
        <p>
          This is the first operating layer above onboarding: customer records give invoices a
          stable reference and prepare the ledger model for receivables later.
        </p>
      </section>

      <section className="dashboard-card span-two">
        {params.error ? <div className="alert">{params.error}</div> : null}
        {params.success ? <div className="success-banner">Customer created successfully.</div> : null}
        <div className="section-head">
          <div>
            <p className="kicker">Create customer</p>
            <h2>Add a billable entity</h2>
          </div>
        </div>
        <form action={createCustomerAction} className="form-grid compact-grid">
          <div className="field">
            <label htmlFor="name">Customer name</label>
            <input id="name" name="name" type="text" placeholder="Northwind Labs" required />
          </div>
          <div className="field">
            <label htmlFor="email">Billing email</label>
            <input id="email" name="email" type="email" placeholder="ap@northwind.test" required />
          </div>
          <div className="field">
            <label htmlFor="billingCurrency">Billing currency</label>
            <select id="billingCurrency" name="billingCurrency" defaultValue="USD">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="actions">
            <button className="button" type="submit">
              Save customer
            </button>
          </div>
        </form>
      </section>

      <section className="dashboard-card span-two">
        <div className="section-head">
          <div>
            <p className="kicker">Directory</p>
            <h2>{customers.length} customer record{customers.length === 1 ? "" : "s"}</h2>
          </div>
          <Link className="ghost-button" href="/invoices/new">
            Create invoice
          </Link>
        </div>

        {customers.length === 0 ? (
          <p className="empty-copy">
            No customers yet. Add your first customer here, then create your first invoice.
          </p>
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Billing currency</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link className="table-link" href={`/customers/${customer.id}`}>
                        {customer.name}
                      </Link>
                    </td>
                    <td>{customer.email}</td>
                    <td>{customer.billingCurrency}</td>
                    <td>{new Date(customer.createdAt).toLocaleDateString()}</td>
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
