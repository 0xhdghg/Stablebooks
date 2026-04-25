import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type AppSession = {
  token: string;
  userId: string;
  createdAt: string;
};

export type AppOrganization = {
  id: string;
  name: string;
  billingCountry: string;
  baseCurrency: string;
  onboardingStatus: "pending_wallet" | "completed";
  createdAt: string;
  updatedAt: string;
};

export type AppMembership = {
  id: string;
  userId: string;
  organizationId: string;
  role: "admin" | "member";
  createdAt: string;
};

export type AppWallet = {
  id: string;
  organizationId: string;
  chain: string;
  address: string;
  label: string;
  role: "collection" | "operating" | "reserve" | "payout";
  isDefaultSettlement: boolean;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
};

export type AppCustomer = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  billingCurrency: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceStatus = "draft" | "open" | "processing" | "paid";

export type AppInvoice = {
  id: string;
  organizationId: string;
  customerId: string;
  referenceCode: string;
  publicToken: string;
  amountMinor: number;
  currency: string;
  dueAt: string;
  memo: string;
  internalNote: string;
  status: InvoiceStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentStatus = "pending" | "processing" | "finalized" | "failed";

export type PaymentMatchResult =
  | "pending"
  | "exact"
  | "unmatched"
  | "ambiguous"
  | "rejected";

export type ObservationStatus = "detected" | "matched" | "confirmed" | "rejected";

export type ConfirmationSource = "admin" | "mock_chain" | "arc_ingestion" | null;

export type AppPayment = {
  id: string;
  organizationId: string;
  invoiceId: string;
  publicToken: string;
  status: PaymentStatus;
  matchResult: PaymentMatchResult;
  matchReason: string | null;
  observationId: string | null;
  amountMinor: number;
  currency: string;
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
  confirmationSource: ConfirmationSource;
  confirmationTxHash: string | null;
  confirmationBlockNumber: number | null;
  sourceConfirmedAt: string | null;
  confirmationReceivedAt: string | null;
  confirmedAt: string | null;
  startedAt: string;
  processingStartedAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentEventType =
  | "payment_session_created"
  | "payment_match_recorded"
  | "payment_processing_started"
  | "payment_confirmation_received"
  | "payment_failure_received"
  | "payment_finalized"
  | "payment_failed"
  | "webhook_delivery_succeeded"
  | "webhook_delivery_failed";

export type AppPaymentEvent = {
  id: string;
  organizationId: string;
  invoiceId: string;
  paymentId: string;
  type: PaymentEventType;
  fromStatus: PaymentStatus | null;
  toStatus: PaymentStatus;
  note: string;
  createdAt: string;
};

export type AppRawChainEvent = {
  id: string;
  organizationId: string | null;
  walletId: string | null;
  chainId: number;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  blockTimestamp: string | null;
  fromAddress: string;
  toAddress: string;
  token: string;
  amountAtomic: string;
  decimals: number;
  sourceConfirmedAt: string | null;
  rawPayload: Record<string, unknown>;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AppChainPaymentObservation = {
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
  status: ObservationStatus;
  observedAt: string;
  sourceConfirmedAt: string | null;
  confirmedAt: string | null;
  rawPayload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type AppPaymentMatch = {
  id: string;
  organizationId: string;
  paymentId: string | null;
  invoiceId: string | null;
  observationId: string;
  matchResult: PaymentMatchResult;
  matchReason: string;
  createdAt: string;
  updatedAt: string;
};

export type WebhookDeliveryStatus =
  | "disabled"
  | "delivered"
  | "failed"
  | "dead_letter";

export type AppWebhookDelivery = {
  id: string;
  organizationId: string;
  invoiceId: string;
  paymentId: string;
  eventId: string;
  eventCreatedAt: string;
  eventType: "payment.finalized" | "payment.failed";
  paymentStatusSnapshot: PaymentStatus;
  invoiceStatusSnapshot: InvoiceStatus;
  replayOfDeliveryId: string | null;
  status: WebhookDeliveryStatus;
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
};

export type AppStore = {
  users: AppUser[];
  sessions: AppSession[];
  organizations: AppOrganization[];
  memberships: AppMembership[];
  wallets: AppWallet[];
  customers: AppCustomer[];
  invoices: AppInvoice[];
  payments: AppPayment[];
  paymentEvents: AppPaymentEvent[];
  rawChainEvents: AppRawChainEvent[];
  chainPaymentObservations: AppChainPaymentObservation[];
  paymentMatches: AppPaymentMatch[];
  webhookDeliveries: AppWebhookDelivery[];
};

const INITIAL_STORE: AppStore = {
  users: [],
  sessions: [],
  organizations: [],
  memberships: [],
  wallets: [],
  customers: [],
  invoices: [],
  payments: [],
  paymentEvents: [],
  rawChainEvents: [],
  chainPaymentObservations: [],
  paymentMatches: [],
  webhookDeliveries: []
};

@Injectable()
export class StorageService {
  private readonly filePath = join(process.cwd(), "data", "app-store.json");

  async read(): Promise<AppStore> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return this.normalize(JSON.parse(raw));
    } catch {
      await this.write(INITIAL_STORE);
      return structuredClone(INITIAL_STORE);
    }
  }

  async write(store: AppStore): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(store, null, 2), "utf8");
  }

  async mutate<T>(mutator: (store: AppStore) => T | Promise<T>): Promise<T> {
    const store = await this.read();
    const result = await mutator(store);
    await this.write(store);
    return result;
  }

  private normalize(input: Partial<AppStore>): AppStore {
    return {
      users: input.users ?? [],
      sessions: input.sessions ?? [],
      organizations: (input.organizations ?? []).map((organization) => ({
        ...organization,
        billingCountry: organization.billingCountry ?? "US",
        baseCurrency: organization.baseCurrency ?? "USD",
        onboardingStatus: organization.onboardingStatus ?? "pending_wallet"
      })),
      memberships: input.memberships ?? [],
      wallets: (input.wallets ?? []).map((wallet) => ({
        ...wallet,
        status: wallet.status ?? "active"
      })),
      customers: (input.customers ?? []).map((customer) => ({
        ...customer,
        metadata: customer.metadata ?? null
      })),
      invoices: input.invoices ?? [],
      payments: (input.payments ?? []).map((payment) => {
        const txHash = payment.txHash ?? payment.confirmationTxHash ?? null;
        const blockNumber =
          payment.blockNumber ?? payment.confirmationBlockNumber ?? null;
        const confirmedAt =
          payment.confirmedAt ?? payment.confirmationReceivedAt ?? null;

        return {
          ...payment,
          matchResult: payment.matchResult ?? "pending",
          matchReason: payment.matchReason ?? null,
          observationId: payment.observationId ?? null,
          token: payment.token ?? null,
          amountAtomic: payment.amountAtomic ?? null,
          decimals: payment.decimals ?? null,
          chainId: payment.chainId ?? null,
          txHash,
          blockNumber,
          fromAddress: payment.fromAddress ?? null,
          toAddress: payment.toAddress ?? null,
          confirmationSource: payment.confirmationSource ?? null,
          confirmationTxHash: payment.confirmationTxHash ?? txHash,
          confirmationBlockNumber:
            payment.confirmationBlockNumber ?? blockNumber,
          sourceConfirmedAt: payment.sourceConfirmedAt ?? null,
          confirmationReceivedAt:
            payment.confirmationReceivedAt ?? confirmedAt,
          confirmedAt,
          processingStartedAt: payment.processingStartedAt ?? null,
          settlementReference: payment.settlementReference ?? null,
          failureReason: payment.failureReason ?? null,
          finalizedAt: payment.finalizedAt ?? null
        };
      }),
      paymentEvents: input.paymentEvents ?? [],
      rawChainEvents: (input.rawChainEvents ?? []).map((event) => ({
        ...event,
        organizationId: event.organizationId ?? null,
        walletId: event.walletId ?? null,
        logIndex: event.logIndex ?? 0,
        blockTimestamp: event.blockTimestamp ?? null,
        sourceConfirmedAt: event.sourceConfirmedAt ?? null,
        rawPayload: event.rawPayload ?? {},
        observedAt: event.observedAt ?? event.createdAt
      })),
      chainPaymentObservations: (input.chainPaymentObservations ?? []).map(
        (observation) => ({
          ...observation,
          walletId: observation.walletId ?? null,
          paymentId: observation.paymentId ?? null,
          invoiceId: observation.invoiceId ?? null,
          rawChainEventId: observation.rawChainEventId ?? null,
          logIndex: observation.logIndex ?? 0,
          status: observation.status ?? "detected",
          observedAt: observation.observedAt ?? observation.createdAt,
          sourceConfirmedAt: observation.sourceConfirmedAt ?? null,
          confirmedAt: observation.confirmedAt ?? null,
          rawPayload: observation.rawPayload ?? null
        })
      ),
      paymentMatches: (input.paymentMatches ?? []).map((match) => ({
        ...match,
        paymentId: match.paymentId ?? null,
        invoiceId: match.invoiceId ?? null
      })),
      webhookDeliveries: (input.webhookDeliveries ?? []).map((delivery) => ({
        ...delivery,
        eventId: delivery.eventId ?? delivery.id,
        eventCreatedAt: delivery.eventCreatedAt ?? delivery.createdAt,
        paymentStatusSnapshot: delivery.paymentStatusSnapshot ?? "pending",
        invoiceStatusSnapshot: delivery.invoiceStatusSnapshot ?? "open",
        replayOfDeliveryId: delivery.replayOfDeliveryId ?? null,
        maxAttempts: delivery.maxAttempts ?? 4,
        nextAttemptAt: delivery.nextAttemptAt ?? null,
        deadLetteredAt: delivery.deadLetteredAt ?? null
      }))
    };
  }
}
