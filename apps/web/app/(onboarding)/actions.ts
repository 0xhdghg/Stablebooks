"use server";

import { redirect } from "next/navigation";
import { createOrganization, createWallet } from "../../lib/api";
import { getSessionToken } from "../../lib/session";

function requireToken(token: string | null) {
  if (!token) {
    redirect("/signin");
  }

  return token;
}

function fail(path: string, error: string) {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

export async function createOrganizationAction(formData: FormData) {
  const token = requireToken(await getSessionToken());

  try {
    await createOrganization(token, {
      name: String(formData.get("name") ?? ""),
      billingCountry: String(formData.get("billingCountry") ?? ""),
      baseCurrency: String(formData.get("baseCurrency") ?? "")
    });
    redirect("/onboarding/wallets");
  } catch (error) {
    fail(
      "/onboarding/org",
      error instanceof Error ? error.message : "Unable to create organization."
    );
  }
}

export async function createWalletAction(formData: FormData) {
  const token = requireToken(await getSessionToken());

  try {
    await createWallet(token, {
      chain: String(formData.get("chain") ?? "Arc"),
      address: String(formData.get("address") ?? ""),
      label: String(formData.get("label") ?? ""),
      role: String(formData.get("role") ?? "operating") as
        | "collection"
        | "operating"
        | "reserve"
        | "payout",
      isDefaultSettlement: String(formData.get("isDefaultSettlement") ?? "on") === "on"
    });
    redirect("/dashboard");
  } catch (error) {
    fail(
      "/onboarding/wallets",
      error instanceof Error ? error.message : "Unable to save wallet."
    );
  }
}
