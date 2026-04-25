import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "../../components/app-shell";
import { getOptionalSession } from "../../lib/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/signin");
  }

  if (!session.onboarding.completed) {
    redirect(session.onboarding.hasOrganization ? "/onboarding/wallets" : "/onboarding/org");
  }

  return (
    <AppShell
      session={session}
      title="Stablebooks Workspace"
      description="Customer records and invoice operations now run on top of the onboarding and session model from Milestone 1."
    >
      {children}
    </AppShell>
  );
}
