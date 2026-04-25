import { redirect } from "next/navigation";
import { createWalletAction } from "../../actions";
import { getOptionalSession } from "../../../../lib/session";

export default async function WalletSetupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/signin");
  }

  if (!session.onboarding.hasOrganization) {
    redirect("/onboarding/org");
  }

  if (session.onboarding.completed) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <div className="stack">
      <div>
        <p className="brand-mark">Step 2 of 2</p>
        <h1 className="page-title">Add the Arc wallet that will receive settlement.</h1>
        <p className="page-copy">
          This first wallet unlocks invoice publishing and becomes the default treasury destination
          for the MVP.
        </p>
      </div>
      {params.error ? <div className="alert">{params.error}</div> : null}
      <form action={createWalletAction} className="form-grid">
        <div className="field">
          <label htmlFor="label">Wallet label</label>
          <input id="label" name="label" type="text" placeholder="Primary Arc Treasury" required />
        </div>
        <div className="field">
          <label htmlFor="address">Wallet address</label>
          <input id="address" name="address" type="text" placeholder="0x1234...abcd" required />
        </div>
        <div className="field">
          <label htmlFor="role">Wallet role</label>
          <select id="role" name="role" defaultValue="operating">
            <option value="operating">Operating</option>
            <option value="collection">Collection</option>
            <option value="reserve">Reserve</option>
            <option value="payout">Payout</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="chain">Chain</label>
          <input id="chain" name="chain" type="text" defaultValue="Arc" required />
        </div>
        <div className="field">
          <label htmlFor="isDefaultSettlement">Default settlement wallet</label>
          <select id="isDefaultSettlement" name="isDefaultSettlement" defaultValue="on">
            <option value="on">Yes, make this the default</option>
            <option value="off">No, save without defaulting</option>
          </select>
        </div>
        <div className="actions">
          <button className="button" type="submit">
            Finish setup
          </button>
        </div>
      </form>
      <div className="summary-card">
        <h2>Current organization</h2>
        <ul className="summary-list">
          <li>
            <strong>Name</strong>
            <span>{session.organization?.name}</span>
          </li>
          <li>
            <strong>Billing country</strong>
            <span>{session.organization?.billingCountry}</span>
          </li>
          <li>
            <strong>Base currency</strong>
            <span>{session.organization?.baseCurrency}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
