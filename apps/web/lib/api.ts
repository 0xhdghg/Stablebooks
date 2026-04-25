const API_BASE_URL = (
  process.env.API_BASE_URL?.trim() || "http://127.0.0.1:4000/api/v1"
).replace(/\/+$/, "");

type ApiSuccess<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

type ApiResponseWithMeta<T, M = Record<string, unknown>> = {
  data: T;
  meta?: M;
};

export type SessionPayload = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
    billingCountry: string;
    baseCurrency: string;
    onboardingStatus: "pending_wallet" | "completed";
  } | null;
  membership: {
    id: string;
    userId: string;
    organizationId: string;
    role: "admin" | "member";
    createdAt: string;
  } | null;
  wallets: Array<{
    id: string;
    organizationId: string;
    chain: string;
    address: string;
    label: string;
    role: "collection" | "operating" | "reserve" | "payout";
    isDefaultSettlement: boolean;
    status: "active";
    createdAt: string;
    updatedAt: string;
  }>;
  onboarding: {
    hasOrganization: boolean;
    hasDefaultSettlementWallet: boolean;
    completed: boolean;
    nextStep: "organization" | "wallet" | "dashboard";
  };
};

export type CustomerRecord = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  billingCurrency: string;
  createdAt: string;
  updatedAt: string;
  invoices?: InvoiceRecord[];
};

export type InvoiceRecord = {
  id: string;
  customerId: string;
  customerName: string;
  referenceCode: string;
  publicToken: string;
  amountMinor: number;
  currency: string;
  dueAt: string;
  memo: string;
  internalNote: string;
  status: "draft" | "open" | "processing" | "paid";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestPaymentStatus?: "pending" | "processing" | "finalized" | "failed" | null;
  customer?: {
    id: string;
    name: string;
    email: string;
    billingCurrency: string;
  } | null;
  payments?: PaymentRecord[];
  timeline?: TimelineRecord[];
};

export type PublicInvoiceRecord = {
  invoiceId: string;
  publicToken: string;
  referenceCode: string;
  customerName: string;
  amountMinor: number;
  currency: string;
  dueAt: string;
  memo: string;
  status: "open" | "processing" | "paid";
  paymentStatus: "pending" | "processing" | "finalized" | "failed" | null;
};

export type PublicInvoiceStatus = {
  invoiceStatus: "open" | "processing" | "paid";
  paymentStatus: "pending" | "processing" | "finalized" | "failed" | null;
  amountPaidMinor: number;
  finalSettlement: boolean;
  redirectHint: "none" | "processing" | "success" | "issue";
};

export type PaymentRecord = {
  id: string;
  organizationId: string;
  invoiceId: string;
  publicToken: string;
  status: "pending" | "processing" | "finalized" | "failed";
  amountMinor: number;
  currency: string;
  matchResult: "pending" | "exact" | "unmatched" | "ambiguous" | "rejected";
  matchReason: string | null;
  observationId: string | null;
  token: string | null;
  amountAtomic: string | null;
  decimals: number | null;
  chainId: number | null;
  txHash: string | null;
  blockNumber: number | null;
  fromAddress: string | null;
  toAddress: string | null;
  settlementReference: string | null;
  failureReason: string | null;
  confirmationSource: "admin" | "mock_chain" | "arc_ingestion" | null;
  confirmationTxHash: string | null;
  confirmationBlockNumber: number | null;
  confirmationReceivedAt: string | null;
  sourceConfirmedAt: string | null;
  confirmedAt: string | null;
  startedAt: string;
  processingStartedAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  providerDiagnostic?: ProviderDiagnostic | null;
  observation?: {
    id: string;
    organizationId: string;
    walletId: string | null;
    paymentId: string | null;
    invoiceId: string | null;
    rawChainEventId: string | null;
    chainId: number;
    txHash: string;
    logIndex: number;
    blockNumber: number;
    fromAddress: string;
    toAddress: string;
    token: string;
    amountAtomic: string;
    decimals: number;
    status: "detected" | "matched" | "confirmed" | "rejected";
    observedAt: string;
    sourceConfirmedAt: string | null;
    confirmedAt: string | null;
    rawPayload: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  paymentMatch?: {
    id: string;
    organizationId: string;
    paymentId: string | null;
    invoiceId: string | null;
    observationId: string;
    matchResult: "pending" | "exact" | "unmatched" | "ambiguous" | "rejected";
    matchReason: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  events: TimelineRecord[];
  webhookDeliveries: WebhookDeliveryRecord[];
};

export type ProviderDiagnostic = {
  boundaryKind: "canonical" | "circle_event_monitor";
  sourceKind: "rpc_polling" | "indexer_polling" | "webhook" | "fixtures";
  sourceProfileMatched: boolean | null;
  providerWarnings: string[];
  rejectedReason: string | null;
};

export type TimelineRecord = {
  id: string;
  type: string;
  note: string;
  createdAt: string;
  paymentId?: string;
  fromStatus?: "pending" | "processing" | "finalized" | "failed" | null;
  toStatus?: "pending" | "processing" | "finalized" | "failed";
};

export type WebhookDeliveryRecord = {
  id: string;
  organizationId: string;
  invoiceId: string;
  paymentId: string;
  eventId: string;
  eventCreatedAt: string;
  eventType: "payment.finalized" | "payment.failed";
  paymentStatusSnapshot: "pending" | "processing" | "finalized" | "failed";
  invoiceStatusSnapshot: "draft" | "open" | "processing" | "paid";
  replayOfDeliveryId: string | null;
  status: "disabled" | "delivered" | "failed" | "dead_letter";
  destination: string | null;
  signature: string | null;
  payload: Record<string, unknown>;
  attemptCount: number;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  maxAttempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  deadLetteredAt: string | null;
  createdAt: string;
  updatedAt: string;
  diagnostic?: {
    severity: "success" | "warning" | "critical";
    label: string;
    detail: string;
    nextAction: string | null;
  };
  isTerminal: boolean;
};

export type WebhookDeliveriesMeta = {
  total: number;
  active: number;
  deadLetter: number;
  disabled: number;
  delivered: number;
};

type FetchOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  token?: string;
};

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const payload = await apiFetchWithMeta<T>(path, options);
  return payload.data;
}

export async function apiFetchWithMeta<T, M = Record<string, unknown>>(
  path: string,
  options: FetchOptions = {}
): Promise<ApiResponseWithMeta<T, M>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    cache: "no-store",
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccess<T>
    | {
        error?: {
          message?: string;
        };
        message?: string;
      }
    | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : payload && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "Request failed.";
    throw new Error(message);
  }

  if (!payload || !("data" in payload)) {
    throw new Error("The API returned an unexpected response.");
  }

  return payload as ApiResponseWithMeta<T, M>;
}

export async function signup(input: {
  name: string;
  email: string;
  password: string;
}) {
  return apiFetch<SessionPayload>("/auth/signup", {
    method: "POST",
    body: input
  });
}

export async function signin(input: { email: string; password: string }) {
  return apiFetch<SessionPayload>("/auth/signin", {
    method: "POST",
    body: input
  });
}

export async function signout(token: string) {
  return apiFetch<{ success: boolean }>("/auth/signout", {
    method: "POST",
    token
  });
}

export async function getMe(token: string) {
  return apiFetch<SessionPayload>("/me", {
    token
  });
}

export async function createOrganization(
  token: string,
  input: { name: string; billingCountry: string; baseCurrency: string }
) {
  return apiFetch<{
    organization: SessionPayload["organization"];
    membership: SessionPayload["membership"];
  }>("/organizations", {
    method: "POST",
    token,
    body: input
  });
}

export async function createWallet(
  token: string,
  input: {
    chain: string;
    address: string;
    label: string;
    role: "collection" | "operating" | "reserve" | "payout";
    isDefaultSettlement: boolean;
  }
) {
  return apiFetch<SessionPayload["wallets"][number]>("/wallets", {
    method: "POST",
    token,
    body: input
  });
}

export async function listCustomers(token: string) {
  return apiFetch<CustomerRecord[]>("/customers", {
    token
  });
}

export async function getCustomer(token: string, customerId: string) {
  return apiFetch<CustomerRecord>(`/customers/${customerId}`, {
    token
  });
}

export async function createCustomer(
  token: string,
  input: { name: string; email: string; billingCurrency: string }
) {
  return apiFetch<CustomerRecord>("/customers", {
    method: "POST",
    token,
    body: input
  });
}

export async function listInvoices(token: string) {
  return apiFetch<InvoiceRecord[]>("/invoices", {
    token
  });
}

export async function getInvoice(token: string, invoiceId: string) {
  return apiFetch<InvoiceRecord>(`/invoices/${invoiceId}`, {
    token
  });
}

export async function getPayment(token: string, paymentId: string) {
  return apiFetch<PaymentRecord>(`/payments/${paymentId}`, {
    token
  });
}

export async function createInvoice(
  token: string,
  input: {
    customerId: string;
    amountMinor: number;
    currency: string;
    dueAt: string;
    memo: string;
    internalNote: string;
    publish: boolean;
  }
) {
  return apiFetch<InvoiceRecord>("/invoices", {
    method: "POST",
    token,
    body: input
  });
}

export async function getPublicInvoice(publicToken: string) {
  return apiFetch<PublicInvoiceRecord>(`/public/invoices/${publicToken}`);
}

export async function getPublicInvoiceStatus(publicToken: string) {
  return apiFetch<PublicInvoiceStatus>(`/public/invoices/${publicToken}/status`);
}

export async function createPublicPaymentSession(publicToken: string) {
  return apiFetch<{
    paymentId: string | null;
    status: "pending" | "processing" | "finalized";
    redirectPath: string;
  }>(`/public/invoices/${publicToken}/payment-session`, {
    method: "POST"
  });
}

export async function finalizePayment(
  token: string,
  paymentId: string,
  input?: { settlementReference?: string }
) {
  return apiFetch<PaymentRecord>(`/payments/${paymentId}/finalize`, {
    method: "POST",
    token,
    body: input ?? {}
  });
}

export async function failPayment(
  token: string,
  paymentId: string,
  input?: { failureReason?: string }
) {
  return apiFetch<PaymentRecord>(`/payments/${paymentId}/fail`, {
    method: "POST",
    token,
    body: input ?? {}
  });
}

export async function retryWebhookDelivery(token: string, deliveryId: string) {
  return apiFetch<WebhookDeliveryRecord>(`/payments/webhook-deliveries/${deliveryId}/retry`, {
    method: "POST",
    token
  });
}

export async function replayPaymentWebhook(token: string, paymentId: string) {
  return apiFetch<WebhookDeliveryRecord>(`/payments/${paymentId}/webhook-replay`, {
    method: "POST",
    token
  });
}

export async function listWebhookDeliveries(
  token: string,
  input?: {
    queue?: "all" | "active" | "dead_letter";
    status?: string;
  }
) {
  const params = new URLSearchParams();
  if (input?.queue) {
    params.set("queue", input.queue);
  }
  if (input?.status) {
    params.set("status", input.status);
  }

  const query = params.toString();
  return apiFetchWithMeta<WebhookDeliveryRecord[], WebhookDeliveriesMeta>(
    `/payments/webhook-deliveries${query ? `?${query}` : ""}`,
    { token }
  );
}
