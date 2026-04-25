import { redirect } from "next/navigation";
import { createInvoiceAction } from "../../actions";
import { getOptionalSession, getSessionToken } from "../../../../lib/session";
import { listCustomers } from "../../../../lib/api";

export default async function NewInvoicePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
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

  if (customers.length === 0) {
    redirect("/customers?error=Create%20a%20customer%20before%20creating%20an%20invoice.");
  }

  return (
    <div className="page-grid">
      <section className="dashboard-card span-two">
        <p className="kicker">Create invoice</p>
        <h2>Issue a stablecoin receivable tied to a customer record.</h2>
        <p>
          This version keeps the model intentionally lean: customer, amount, currency, due date,
          memo, and internal note.
        </p>
      </section>

      <section className="dashboard-card span-two">
        {params.error ? <div className="alert">{params.error}</div> : null}
        <form action={createInvoiceAction} className="form-grid compact-grid">
          <div className="field">
            <label htmlFor="customerId">Customer</label>
            <select id="customerId" name="customerId" defaultValue={customers[0]?.id}>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.email})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="amountMinor">Amount in minor units</label>
            <input id="amountMinor" name="amountMinor" type="number" min="1" placeholder="250000" required />
          </div>
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <select id="currency" name="currency" defaultValue="USD">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="dueAt">Due date</label>
            <input id="dueAt" name="dueAt" type="date" required />
          </div>
          <div className="field span-two">
            <label htmlFor="memo">Memo</label>
            <input id="memo" name="memo" type="text" placeholder="March retainer for treasury ops" required />
          </div>
          <div className="field span-two">
            <label htmlFor="internalNote">Internal note</label>
            <input id="internalNote" name="internalNote" type="text" placeholder="Close manually if needed during pilot." />
          </div>
          <div className="field">
            <label htmlFor="publish">Invoice status</label>
            <select id="publish" name="publish" defaultValue="true">
              <option value="true">Publish as open invoice</option>
              <option value="false">Save as draft</option>
            </select>
          </div>
          <div className="actions">
            <button className="button" type="submit">
              Create invoice
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
