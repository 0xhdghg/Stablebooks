"use server";

import { redirect } from "next/navigation";
import {
  createCustomer,
  createInvoice,
  failPayment,
  finalizePayment,
  replayPaymentWebhook,
  retryWebhookDelivery
} from "../../lib/api";
import { getSessionToken } from "../../lib/session";

function requireToken(token: string | null) {
  if (!token) {
    redirect("/signin");
  }

  return token;
}

function withQuery(path: string, key: string, value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function fail(path: string, error: string) {
  redirect(withQuery(path, "error", error));
}

export async function createCustomerAction(formData: FormData) {
  const token = requireToken(await getSessionToken());

  try {
    await createCustomer(token, {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      billingCurrency: String(formData.get("billingCurrency") ?? "")
    });
    redirect("/customers?success=customer-created");
  } catch (error) {
    fail(
      "/customers",
      error instanceof Error ? error.message : "Unable to create customer."
    );
  }
}

export async function createInvoiceAction(formData: FormData) {
  const token = requireToken(await getSessionToken());

  try {
    const invoice = await createInvoice(token, {
      customerId: String(formData.get("customerId") ?? ""),
      amountMinor: Number(formData.get("amountMinor") ?? 0),
      currency: String(formData.get("currency") ?? ""),
      dueAt: String(formData.get("dueAt") ?? ""),
      memo: String(formData.get("memo") ?? ""),
      internalNote: String(formData.get("internalNote") ?? ""),
      publish: String(formData.get("publish") ?? "true") === "true"
    });
    redirect(`/invoices/${invoice.id}`);
  } catch (error) {
    fail(
      "/invoices/new",
      error instanceof Error ? error.message : "Unable to create invoice."
    );
  }
}

export async function finalizePaymentAction(formData: FormData) {
  const token = requireToken(await getSessionToken());
  const paymentId = String(formData.get("paymentId") ?? "");
  const invoiceId = String(formData.get("invoiceId") ?? "");

  try {
    await finalizePayment(token, paymentId, {
      settlementReference: String(formData.get("settlementReference") ?? "")
    });
    redirect(`/invoices/${invoiceId}?success=payment-finalized`);
  } catch (error) {
    fail(
      `/invoices/${invoiceId}`,
      error instanceof Error ? error.message : "Unable to finalize payment."
    );
  }
}

export async function failPaymentAction(formData: FormData) {
  const token = requireToken(await getSessionToken());
  const paymentId = String(formData.get("paymentId") ?? "");
  const invoiceId = String(formData.get("invoiceId") ?? "");

  try {
    await failPayment(token, paymentId, {
      failureReason: String(formData.get("failureReason") ?? "")
    });
    redirect(`/invoices/${invoiceId}?success=payment-failed`);
  } catch (error) {
    fail(
      `/invoices/${invoiceId}`,
      error instanceof Error ? error.message : "Unable to mark payment failed."
    );
  }
}

export async function retryWebhookDeliveryAction(formData: FormData) {
  const token = requireToken(await getSessionToken());
  const deliveryId = String(formData.get("deliveryId") ?? "");
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "") || `/invoices/${invoiceId}`;

  try {
    await retryWebhookDelivery(token, deliveryId);
    redirect(withQuery(redirectTo, "success", "webhook-retried"));
  } catch (error) {
    fail(
      redirectTo,
      error instanceof Error ? error.message : "Unable to retry webhook delivery."
    );
  }
}

export async function replayPaymentWebhookAction(formData: FormData) {
  const token = requireToken(await getSessionToken());
  const paymentId = String(formData.get("paymentId") ?? "");
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "") || `/invoices/${invoiceId}`;

  try {
    await replayPaymentWebhook(token, paymentId);
    redirect(withQuery(redirectTo, "success", "webhook-replayed"));
  } catch (error) {
    fail(
      redirectTo,
      error instanceof Error ? error.message : "Unable to replay webhook event."
    );
  }
}
