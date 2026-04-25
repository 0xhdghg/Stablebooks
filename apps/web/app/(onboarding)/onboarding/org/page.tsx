import { redirect } from "next/navigation";
import { createOrganizationAction } from "../../actions";
import { getOptionalSession } from "../../../../lib/session";

export default async function OrganizationSetupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/signin");
  }

  if (session.onboarding.hasOrganization) {
    redirect("/onboarding/wallets");
  }

  const params = await searchParams;

  return (
    <div className="stack">
      <div>
        <p className="brand-mark">Step 1 of 2</p>
        <h1 className="page-title">Create the organization behind your treasury.</h1>
        <p className="page-copy">
          We only need the operating identity that will own invoices and settlement wallets.
        </p>
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}
      <form action={createOrganizationAction} className="form-grid">
        <div className="field">
          <label htmlFor="name">Organization name</label>
          <input id="name" name="name" type="text" placeholder="Stablebooks Studio" required />
        </div>
        <div className="field">
          <label htmlFor="billingCountry">Billing country</label>
          <input id="billingCountry" name="billingCountry" type="text" placeholder="US" required />
        </div>
        <div className="field">
          <label htmlFor="baseCurrency">Base currency</label>
          <select id="baseCurrency" name="baseCurrency" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <div className="actions">
          <button className="button" type="submit">
            Continue to wallet setup
          </button>
        </div>
      </form>
      <div className="info-card">
        <h2>Why this step exists</h2>
        <p>
          Invoices, wallets, and export history all anchor to one organization record. This keeps
          the product ready for a multi-entity future without overcomplicating the MVP.
        </p>
      </div>
    </div>
  );
}
