import { Injectable, NotFoundException } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import {
  AppChainPaymentObservation,
  AppInvoice,
  AppPayment,
  AppWebhookDelivery,
  StorageService,
  WebhookDeliveryStatus
} from "../storage/storage.service";
import { WebhookDeliveryRepository } from "../storage/webhook-delivery.repository";
import { buildWebhookDeliveryDiagnostic } from "../storage/webhook-delivery-diagnostics";

type PaymentWebhookEventType = AppWebhookDelivery["eventType"];
type PostgresWebhookDelivery = Awaited<
  ReturnType<WebhookDeliveryRepository["createDeliveryForPayment"]>
>;

@Injectable()
export class WebhooksService {
  constructor(
    private readonly storage: StorageService,
    private readonly webhookDeliveryRepository: WebhookDeliveryRepository
  ) {}

  async dispatchPaymentFinalized(input: {
    invoice: AppInvoice;
    payment: AppPayment;
  }) {
    return this.dispatchPaymentEvent({
      invoice: input.invoice,
      payment: input.payment,
      eventType: "payment.finalized"
    });
  }

  async dispatchPaymentFailed(input: {
    invoice: AppInvoice;
    payment: AppPayment;
  }) {
    return this.dispatchPaymentEvent({
      invoice: input.invoice,
      payment: input.payment,
      eventType: "payment.failed"
    });
  }

  async dispatchPaymentFinalizedForPaymentId(paymentId: string) {
    return this.dispatchPostgresPaymentEvent({
      paymentId,
      eventType: "payment.finalized"
    });
  }

  async dispatchPaymentFailedForPaymentId(paymentId: string) {
    return this.dispatchPostgresPaymentEvent({
      paymentId,
      eventType: "payment.failed"
    });
  }

  async listDeliveries(input: {
    organizationId: string;
    statuses?: WebhookDeliveryStatus[];
    queue?: "all" | "active" | "dead_letter";
  }) {
    const store = await this.storage.read();
    const records = store.webhookDeliveries
      .filter((delivery) => delivery.organizationId === input.organizationId)
      .filter((delivery) =>
        input.statuses?.length ? input.statuses.includes(delivery.status) : true
      )
      .filter((delivery) => {
        if (!input.queue || input.queue === "all") {
          return true;
        }

        if (input.queue === "dead_letter") {
          return delivery.status === "dead_letter";
        }

        return delivery.status === "failed" || delivery.status === "disabled";
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((delivery) => this.serializeDelivery(delivery));

    const meta = {
      total: records.length,
      active: records.filter((entry) => entry.status === "failed").length,
      deadLetter: records.filter((entry) => entry.status === "dead_letter").length,
      disabled: records.filter((entry) => entry.status === "disabled").length,
      delivered: records.filter((entry) => entry.status === "delivered").length
    };

    return { records, meta };
  }

  async retryDelivery(input: { deliveryId: string; organizationId: string }) {
    const snapshot = await this.storage.read();
    const delivery = snapshot.webhookDeliveries.find(
      (entry) =>
        entry.id === input.deliveryId && entry.organizationId === input.organizationId
    );

    if (!delivery) {
      throw new NotFoundException("Webhook delivery not found.");
    }

    return this.attemptPersistedDelivery(delivery.id, delivery.paymentStatusSnapshot);
  }

  async retryPostgresDelivery(input: {
    deliveryId: string;
    organizationId: string;
  }) {
    const delivery = await this.webhookDeliveryRepository.getDelivery(
      input.deliveryId,
      input.organizationId
    );

    return this.attemptPostgresDelivery(delivery);
  }

  async replayPaymentEvent(input: {
    organizationId: string;
    invoice: AppInvoice;
    payment: AppPayment;
  }) {
    if (input.payment.organizationId !== input.organizationId) {
      throw new NotFoundException("Payment not found.");
    }

    const eventType = this.resolveEventTypeForPayment(input.payment);
    const store = await this.storage.read();
    const latestDelivery =
      store.webhookDeliveries
        .filter((entry) => entry.paymentId === input.payment.id)
        .filter((entry) => entry.eventType === eventType)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

    if (latestDelivery) {
      return this.createDeliveryFromPayload({
        invoice: input.invoice,
        payment: input.payment,
        eventType,
        eventId: latestDelivery.eventId,
        eventCreatedAt: latestDelivery.eventCreatedAt,
        payload: latestDelivery.payload,
        replayOfDeliveryId: latestDelivery.id
      });
    }

    return this.dispatchPaymentEvent({
      invoice: input.invoice,
      payment: input.payment,
      eventType
    });
  }

  async replayPostgresPaymentEvent(input: {
    organizationId: string;
    paymentId: string;
  }) {
    const delivery =
      await this.webhookDeliveryRepository.createReplayDelivery({
        organizationId: input.organizationId,
        paymentId: input.paymentId,
        maxAttempts: this.getMaxAttempts()
      });

    return this.attemptPostgresDelivery(delivery);
  }

  async processDueRetries() {
    const store = await this.storage.read();
    const now = new Date().toISOString();
    const due = store.webhookDeliveries
      .filter((delivery) => delivery.status === "failed")
      .filter((delivery) => delivery.nextAttemptAt && delivery.nextAttemptAt <= now)
      .sort((a, b) => a.nextAttemptAt!.localeCompare(b.nextAttemptAt!));

    for (const delivery of due) {
      await this.attemptPersistedDelivery(delivery.id, delivery.paymentStatusSnapshot);
    }
  }

  private async dispatchPaymentEvent(input: {
    invoice: AppInvoice;
    payment: AppPayment;
    eventType: PaymentWebhookEventType;
  }) {
    const snapshot = await this.storage.read();
    const observation =
      input.payment.observationId
        ? snapshot.chainPaymentObservations.find(
            (entry) => entry.id === input.payment.observationId
          ) ?? null
        : null;
    const eventCreatedAt = new Date().toISOString();
    const eventId = this.createId("evt");
    const payload = this.buildPayload({
      eventId,
      eventType: input.eventType,
      invoice: input.invoice,
      payment: input.payment,
      observation,
      eventCreatedAt
    });

    return this.createDeliveryFromPayload({
      invoice: input.invoice,
      payment: input.payment,
      eventType: input.eventType,
      eventId,
      eventCreatedAt,
      payload
    });
  }

  private async dispatchPostgresPaymentEvent(input: {
    paymentId: string;
    eventType: PaymentWebhookEventType;
  }) {
    const delivery =
      await this.webhookDeliveryRepository.createDeliveryForPayment({
        paymentId: input.paymentId,
        eventType: input.eventType,
        maxAttempts: this.getMaxAttempts()
      });

    return this.attemptPostgresDelivery(delivery);
  }

  private async attemptPostgresDelivery(delivery: PostgresWebhookDelivery) {
    const destination = this.getWebhookUrl() ?? delivery.destination;
    if (!destination) {
      return this.webhookDeliveryRepository.updateDeliveryAfterAttempt({
        deliveryId: delivery.id,
        status: "disabled",
        destination: null,
        signature: null,
        responseStatus: null,
        responseBody: null,
        errorMessage: "No STABLEBOOKS_WEBHOOK_URL configured.",
        deliveredAt: null,
        baseDelayMs: this.getBaseDelayMs()
      });
    }

    const signature = this.createSignature(delivery.payload);

    try {
      const response = await fetch(destination, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "stablebooks-webhooks/0.1",
          "X-Stablebooks-Event": delivery.eventType,
          "X-Stablebooks-Event-Id": delivery.eventId,
          "X-Stablebooks-Event-Type": delivery.eventType,
          "X-Stablebooks-Delivery-Id": delivery.id,
          "X-Stablebooks-Signature": signature
        },
        body: JSON.stringify(delivery.payload)
      });

      const responseBody = await response.text().catch(() => "");
      return this.webhookDeliveryRepository.updateDeliveryAfterAttempt({
        deliveryId: delivery.id,
        status: response.ok ? "delivered" : "failed",
        destination,
        signature,
        responseStatus: response.status,
        responseBody,
        errorMessage: response.ok
          ? null
          : `Webhook endpoint returned HTTP ${response.status}.`,
        deliveredAt: response.ok ? new Date().toISOString() : null,
        baseDelayMs: this.getBaseDelayMs()
      });
    } catch (error) {
      return this.webhookDeliveryRepository.updateDeliveryAfterAttempt({
        deliveryId: delivery.id,
        status: "failed",
        destination,
        signature,
        responseStatus: null,
        responseBody: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unknown webhook delivery failure.",
        deliveredAt: null,
        baseDelayMs: this.getBaseDelayMs()
      });
    }
  }

  private async createDeliveryFromPayload(input: {
    invoice: AppInvoice;
    payment: AppPayment;
    eventType: PaymentWebhookEventType;
    eventId: string;
    eventCreatedAt: string;
    payload: Record<string, unknown>;
    replayOfDeliveryId?: string;
  }) {
    const createdAt = new Date().toISOString();
    const draftDelivery: AppWebhookDelivery = {
      id: this.createId("whdlv"),
      organizationId: input.payment.organizationId,
      invoiceId: input.payment.invoiceId,
      paymentId: input.payment.id,
      eventId: input.eventId,
      eventCreatedAt: input.eventCreatedAt,
      eventType: input.eventType,
      paymentStatusSnapshot: input.payment.status,
      invoiceStatusSnapshot: input.invoice.status,
      replayOfDeliveryId: input.replayOfDeliveryId ?? null,
      status: "failed",
      destination: null,
      signature: null,
      payload: input.payload,
      attemptCount: 0,
      responseStatus: null,
      responseBody: null,
      errorMessage: null,
      maxAttempts: this.getMaxAttempts(),
      lastAttemptAt: null,
      nextAttemptAt: null,
      deliveredAt: null,
      deadLetteredAt: null,
      createdAt,
      updatedAt: createdAt
    };

    await this.storage.mutate((store) => {
      store.webhookDeliveries.push(draftDelivery);
    });

    return this.attemptPersistedDelivery(
      draftDelivery.id,
      draftDelivery.paymentStatusSnapshot
    );
  }

  private async attemptPersistedDelivery(
    deliveryId: string,
    paymentStatus: AppPayment["status"]
  ) {
    const store = await this.storage.read();
    const delivery = store.webhookDeliveries.find((entry) => entry.id === deliveryId);
    if (!delivery) {
      throw new NotFoundException("Webhook delivery not found.");
    }

    const destination = this.getWebhookUrl() ?? delivery.destination;
    if (!destination) {
      return this.updateDeliveryAfterAttempt({
        deliveryId,
        paymentStatus,
        status: "disabled",
        destination: null,
        signature: null,
        responseStatus: null,
        responseBody: null,
        errorMessage: "No STABLEBOOKS_WEBHOOK_URL configured.",
        deliveredAt: null
      });
    }

    const signature = this.createSignature(delivery.payload);

    try {
      const response = await fetch(destination, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "stablebooks-webhooks/0.1",
          "X-Stablebooks-Event": delivery.eventType,
          "X-Stablebooks-Event-Id": delivery.eventId,
          "X-Stablebooks-Event-Type": delivery.eventType,
          "X-Stablebooks-Delivery-Id": delivery.id,
          "X-Stablebooks-Signature": signature
        },
        body: JSON.stringify(delivery.payload)
      });

      const responseBody = await response.text().catch(() => "");
      return this.updateDeliveryAfterAttempt({
        deliveryId,
        paymentStatus,
        status: response.ok ? "delivered" : "failed",
        destination,
        signature,
        responseStatus: response.status,
        responseBody,
        errorMessage: response.ok ? null : `Webhook endpoint returned HTTP ${response.status}.`,
        deliveredAt: response.ok ? new Date().toISOString() : null
      });
    } catch (error) {
      return this.updateDeliveryAfterAttempt({
        deliveryId,
        paymentStatus,
        status: "failed",
        destination,
        signature,
        responseStatus: null,
        responseBody: null,
        errorMessage:
          error instanceof Error ? error.message : "Unknown webhook delivery failure.",
        deliveredAt: null
      });
    }
  }

  private async updateDeliveryAfterAttempt(input: {
    deliveryId: string;
    paymentStatus: AppPayment["status"];
    status: AppWebhookDelivery["status"];
    destination: string | null;
    signature: string | null;
    responseStatus: number | null;
    responseBody: string | null;
    errorMessage: string | null;
    deliveredAt: string | null;
  }) {
    return this.storage.mutate((store) => {
      const delivery = store.webhookDeliveries.find((entry) => entry.id === input.deliveryId);
      if (!delivery) {
        throw new NotFoundException("Webhook delivery not found.");
      }

      const attemptAt = new Date().toISOString();
      const nextAttemptCount = delivery.attemptCount + 1;
      const willDeadLetter =
        input.status === "failed" && nextAttemptCount >= delivery.maxAttempts;

      delivery.status = willDeadLetter ? "dead_letter" : input.status;
      delivery.destination = input.destination;
      delivery.signature = input.signature;
      delivery.attemptCount = nextAttemptCount;
      delivery.responseStatus = input.responseStatus;
      delivery.responseBody = input.responseBody;
      delivery.errorMessage = input.errorMessage;
      delivery.lastAttemptAt = attemptAt;
      delivery.deliveredAt = input.deliveredAt;
      delivery.nextAttemptAt =
        input.status === "failed" && !willDeadLetter
          ? this.computeNextAttemptAt(attemptAt, nextAttemptCount)
          : null;
      delivery.deadLetteredAt = willDeadLetter ? attemptAt : null;
      delivery.updatedAt = input.deliveredAt ?? attemptAt;

      store.paymentEvents.push({
        id: this.createId("evt"),
        organizationId: delivery.organizationId,
        invoiceId: delivery.invoiceId,
        paymentId: delivery.paymentId,
        type:
          delivery.status === "delivered"
            ? "webhook_delivery_succeeded"
            : "webhook_delivery_failed",
        fromStatus: input.paymentStatus,
        toStatus: input.paymentStatus,
        note: this.buildDeliveryNote(delivery, input, willDeadLetter),
        createdAt: delivery.updatedAt
      });

      return this.serializeDelivery(delivery);
    });
  }

  private serializeDelivery(delivery: AppWebhookDelivery) {
    return {
      ...delivery,
      diagnostic: buildWebhookDeliveryDiagnostic({
        status: delivery.status,
        destination: delivery.destination,
        responseStatus: delivery.responseStatus,
        errorMessage: delivery.errorMessage,
        attemptCount: delivery.attemptCount,
        maxAttempts: delivery.maxAttempts,
        nextAttemptAt: delivery.nextAttemptAt,
        deliveredAt: delivery.deliveredAt,
        deadLetteredAt: delivery.deadLetteredAt
      }),
      isTerminal:
        delivery.status === "delivered" ||
        delivery.status === "disabled" ||
        delivery.status === "dead_letter"
    };
  }

  private buildPayload(input: {
    eventId: string;
    eventType: PaymentWebhookEventType;
    invoice: AppInvoice;
    payment: AppPayment;
    observation: AppChainPaymentObservation | null;
    eventCreatedAt: string;
  }) {
    return {
      id: input.eventId,
      type: input.eventType,
      version: "2026-04-19",
      createdAt: input.eventCreatedAt,
      livemode: false,
      data: {
        outcome: {
          paymentStatus: input.payment.status,
          invoiceStatus: input.invoice.status,
          matchResult: input.payment.matchResult,
          confirmationSource: input.payment.confirmationSource,
          confirmedAt: input.payment.confirmedAt,
          emittedAt: input.eventCreatedAt
        },
        payment: {
          id: input.payment.id,
          invoiceId: input.payment.invoiceId,
          organizationId: input.payment.organizationId,
          publicToken: input.payment.publicToken,
          status: input.payment.status,
          matchResult: input.payment.matchResult,
          matchReason: input.payment.matchReason,
          observationId: input.payment.observationId,
          amountMinor: input.payment.amountMinor,
          currency: input.payment.currency,
          token: input.payment.token,
          amountAtomic: input.payment.amountAtomic,
          decimals: input.payment.decimals,
          chainId: input.payment.chainId,
          txHash: input.payment.txHash,
          blockNumber: input.payment.blockNumber,
          fromAddress: input.payment.fromAddress,
          toAddress: input.payment.toAddress,
          settlementReference: input.payment.settlementReference,
          failureReason: input.payment.failureReason,
          confirmationSource: input.payment.confirmationSource,
          confirmationTxHash: input.payment.confirmationTxHash,
          confirmationBlockNumber: input.payment.confirmationBlockNumber,
          confirmationReceivedAt: input.payment.confirmationReceivedAt,
          confirmedAt: input.payment.confirmedAt,
          processingStartedAt: input.payment.processingStartedAt,
          finalizedAt: input.payment.finalizedAt
        },
        invoice: {
          id: input.invoice.id,
          referenceCode: input.invoice.referenceCode,
          publicToken: input.invoice.publicToken,
          status: input.invoice.status,
          amountMinor: input.invoice.amountMinor,
          currency: input.invoice.currency,
          dueAt: input.invoice.dueAt
        },
        observation: input.observation
          ? {
              id: input.observation.id,
              rawChainEventId: input.observation.rawChainEventId,
              status: input.observation.status,
              chainId: input.observation.chainId,
              txHash: input.observation.txHash,
              logIndex: input.observation.logIndex,
              blockNumber: input.observation.blockNumber,
              fromAddress: input.observation.fromAddress,
              toAddress: input.observation.toAddress,
              token: input.observation.token,
              amountAtomic: input.observation.amountAtomic,
              decimals: input.observation.decimals,
              observedAt: input.observation.observedAt,
              confirmedAt: input.observation.confirmedAt
            }
          : null
      }
    };
  }

  private buildDeliveryNote(
    delivery: AppWebhookDelivery,
    result: {
      status: AppWebhookDelivery["status"];
      destination: string | null;
      responseStatus: number | null;
      errorMessage: string | null;
    },
    isDeadLetter: boolean
  ) {
    const replayPrefix = delivery.replayOfDeliveryId
      ? `Replay of delivery ${delivery.replayOfDeliveryId}. `
      : "";

    if (!result.destination) {
      return `${replayPrefix}Outbound ${delivery.eventType} webhook skipped because no destination is configured.`;
    }

    if (delivery.status === "delivered") {
      return `${replayPrefix}Outbound ${delivery.eventType} webhook delivered to ${result.destination}.`;
    }

    if (isDeadLetter) {
      return `${replayPrefix}Outbound ${delivery.eventType} webhook moved to dead-letter queue after ${delivery.attemptCount} attempts.`;
    }

    if (result.responseStatus) {
      return `${replayPrefix}Outbound ${delivery.eventType} webhook failed with HTTP ${result.responseStatus} and was scheduled for retry.`;
    }

    return `${replayPrefix}Outbound ${delivery.eventType} webhook failed before completion and was scheduled for retry: ${result.errorMessage ?? "unknown error"}`;
  }

  private computeNextAttemptAt(attemptAt: string, attemptCount: number) {
    const baseDelayMs = this.getBaseDelayMs();
    const delayMs = Math.min(baseDelayMs * 2 ** Math.max(attemptCount - 1, 0), 60_000);
    return new Date(new Date(attemptAt).getTime() + delayMs).toISOString();
  }

  private resolveEventTypeForPayment(payment: AppPayment): PaymentWebhookEventType {
    if (payment.status === "finalized") {
      return "payment.finalized";
    }

    if (payment.status === "failed") {
      return "payment.failed";
    }

    throw new NotFoundException("Only finalized or failed payments can be replayed.");
  }

  private createSignature(payload: unknown) {
    return createHmac("sha256", this.getWebhookSecret())
      .update(JSON.stringify(payload))
      .digest("hex");
  }

  private getWebhookSecret() {
    return process.env.STABLEBOOKS_WEBHOOK_SECRET?.trim() || "stablebooks-dev-webhook-secret";
  }

  private getWebhookUrl() {
    const value = process.env.STABLEBOOKS_WEBHOOK_URL?.trim();
    return value ? value : null;
  }

  private getMaxAttempts() {
    const value = Number(process.env.STABLEBOOKS_WEBHOOK_MAX_ATTEMPTS ?? "4");
    return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 4;
  }

  private getBaseDelayMs() {
    const value = Number(process.env.STABLEBOOKS_WEBHOOK_RETRY_BASE_MS ?? "5000");
    return Number.isFinite(value) && value >= 500 ? Math.floor(value) : 5000;
  }

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(8).toString("hex")}`;
  }
}
