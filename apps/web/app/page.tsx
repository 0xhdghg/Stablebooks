import { redirect } from "next/navigation";
import { getOptionalSession } from "../lib/session";

export default async function RootPage() {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/signin");
  }

  if (!session.onboarding.hasOrganization) {
    redirect("/onboarding/org");
  }

  if (!session.onboarding.hasDefaultSettlementWallet) {
    redirect("/onboarding/wallets");
  }

  redirect("/dashboard");
}
