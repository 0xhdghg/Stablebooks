"use server";

import { redirect } from "next/navigation";
import { createPublicPaymentSession } from "../../lib/api";

export async function startPaymentSessionAction(formData: FormData) {
  const publicToken = String(formData.get("publicToken") ?? "");

  if (!publicToken) {
    redirect("/signin");
  }

  try {
    const session = await createPublicPaymentSession(publicToken);
    redirect(session.redirectPath);
  } catch {
    redirect(`/pay/${publicToken}/issue`);
  }
}
