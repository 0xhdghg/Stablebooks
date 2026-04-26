"use server";

import { redirect } from "next/navigation";
import { createPublicPaymentSession } from "../../lib/api";

export async function startPaymentSessionAction(formData: FormData) {
  const publicToken = String(formData.get("publicToken") ?? "");
  let destination = `/pay/${publicToken}/issue`;

  if (!publicToken) {
    redirect("/signin");
  }

  try {
    const session = await createPublicPaymentSession(publicToken);
    destination = session.redirectPath;
  } catch {
    destination = `/pay/${publicToken}/issue`;
  }

  redirect(destination);
}
