import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getOptionalSession } from "../../lib/session";

export default async function OnboardingLayout({
  children
}: {
  children: ReactNode;
}) {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/signin");
  }

  if (session.onboarding.completed) {
    redirect("/dashboard");
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card">{children}</div>
    </div>
  );
}
