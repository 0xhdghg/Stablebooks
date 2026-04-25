import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  PaymentEventType,
  PaymentStatus,
  Prisma,
  WebhookDeliveryStatus,
  WebhookEventType
} from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { buildWebhookDeliveryDiagnostic } from "./webhook-delivery-diagnostics";

type AppWebhookEventType = "payment.finalized" | "payment.failed";

type CreateWebhookDeliveryInput = {
  paymentId: string;
  eventType: AppWebhookEventType;
  eventId?: string;
  eventCreatedAt?: string;
  replayOfDeliveryId?: string | null;
  maxAttempts?: number;
};

type UpdateDeliveryAttemptInput = {
  deliveryId: string;
  status: "disabled" | "delivered" | "failed";
  destination: string | null;
  signature: string | null;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  deliveredAt: string | null;
  baseDelayMs?: number;
};

type ReplayPaymentWebhookInput = {
  organizationId: string;
  paymentId: string;
  maxAttempts?: number;
};

type ListWebhookDeliveriesInput = {
  organizationId: string;
  statuses?: Array<"disabled" | "delivered" | "failed" | "dead_letter">;
  queue?: "all" | "active" | "dead_letter";
};

type WebhookPayment = Prisma.PaymentGetPayload<{
  include: {
    invoice: true;
    observation: true;
  };
}>;

type WebhookDeliveryRecord = Prisma.WebhookDeliveryGetPayload<Record<string, never>>;

@Injectable()
export class WebhookDeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listDeliveries(input: ListWebhookDeliveriesInput) {
    const statusFilter = input.statuses?.length
      ? input.statuses.map((status) => this.toPrismaDeliveryStatus(status))
      : null;
    const queueStatuses =
      !input.queue || input.queue === "all"
        ? null
        : input.queue === "dead_letter"
          ? [WebhookDeliveryStatus.dead_letter]
          : [WebhookDeliveryStatus.failed, WebhookDeliveryStatus.disabled];
    const statuses = statusFilter ?? queueStatuses;

    const records = await this.prisma.webhookDelivery.findMany({
      where: {
        organizationId: input.organizationId,
        ...(statuses ? { status: { in: statuses } } : {})
      },
      orderBy: [{ createdAt: "desc" }]
    });
    const serialized = records.map((delivery) => this.serializeDelivery(delivery));

    return {
      records: serialized,
      meta: {
        total: serialized.length,
        active: serialized.filter((entry) => entry.status === "failed").length,
        deadLetter: serialized.filter((entry) => entry.status === "dead_letter")
          .length,
        disabled: serialized.filter((entry) => entry.status === "disabled")
          .length,
        delivered: serialized.filter((entry) => entry.status === "delivered")
          .length
      }
    };
  }

  async getDelivery(deliveryId: string, organizationId?: string) {
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        ...(organizationId ? { organizationId } : {})
      }
    });

    if (!delivery) {
      throw new NotFoundException("Webhook delivery not found.");
    }

    return this.serializeDelivery(delivery);
  }

  async createReplayDelivery(input: ReplayPaymentWebhookInput) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: input.paymentId,
        organizationId: input.organizationId
      },
      include: {
        invoice: true
      }
    });

    if (!payment) {
      throw new NotFoundException("Payment not found.");
    }

    const eventType = this.resolveEventTypeForPayment(payment.status);
    const latestDelivery = await this.prisma.webhookDelivery.findFirst({
      where: {
        paymentId: payment.id,
        eventType: this.toPrismaEventType(eventType)
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return this.createDeliveryForPayment({
      paymentId: payment.id,
      eventType,
      eventId: latestDelivery?.eventId,
      eventCreatedAt: latestDelivery?.eventCreatedAt.toISOString(),
      replayOfDeliveryId: latestDelivery?.id ?? null,
      maxAttempts: input.maxAttempts
    });
  }

  async createDeliveryForPayment(input: CreateWebhookDeliveryInput) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        invoice: true,
        observation: true
      }
    });

    if (!payment) {
      throw new NotFoundException("Payment not found.");
    }

    const eventCreatedAt = input.eventCreatedAt
      ? this.parseIsoDate(input.eventCreatedAt, "eventCreatedAt")
      : new Date();
    const eventId = input.eventId?.trim() || this.createId("evt");
    const eventType = this.toPrismaEventType(input.eventType);
    const payload = this.buildPayload({
      eventId,
      eventType: input.eventType,
      invoice: payment.invoice,
      payment,
      observation: payment.observation,
      eventCreatedAt
    });

    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        id: this.createId("whdlv"),
        organizationId: payment.organizationId,
        invoiceId: payment.invoiceId,
        paymentId: payment.id,
        eventId,
        eventCreatedAt,
        eventType,
        paymentStatusSnapshot: payment.status,
        invoiceStatusSnapshot: payment.invoice.status,
        replayOfDeliveryId: input.replayOfDeliveryId ?? null,
        status: WebhookDeliveryStatus.failed,
        destination: null,
        signature: null,
        payload: payload as Prisma.InputJsonValue,
        attemptCount: 0,
        responseStatus: null,
        responseBody: null,
        errorMessage: null,
        maxAttempts: this.normalizeMaxAttempts(input.maxAttempts),
        lastAttemptAt: null,
        nextAttemptAt: null,
        deliveredAt: null,
        deadLetteredAt: null
      }
    });

    return this.serializeDelivery(delivery);
  }

  async updateDeliveryAfterAttempt(input: UpdateDeliveryAttemptInput) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: input.deliveryId }
    });

    if (!delivery) {
      throw new NotFoundException("Webhook delivery not found.");
    }

    const attemptAt = new Date();
    const deliveredAt = input.deliveredAt
      ? this.parseIsoDate(input.deliveredAt, "deliveredAt")
      : null;
    const nextAttemptCount = delivery.attemptCount + 1;
    const willDeadLetter =
      input.status === "failed" && nextAttemptCount >= delivery.maxAttempts;
    const nextStatus = willDeadLetter
      ? WebhookDeliveryStatus.dead_letter
      : this.toPrismaDeliveryStatus(input.status);
    const nextAttemptAt =
      input.status === "failed" && !willDeadLetter
        ? this.computeNextAttemptAt(
            attemptAt,
            nextAttemptCount,
            input.baseDelayMs
          )
        : null;
    const updatedAt = deliveredAt ?? attemptAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedDelivery = await tx.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: nextStatus,
          destination: input.destination,
          signature: input.signature,
          attemptCount: nextAttemptCount,
          responseStatus: input.responseStatus,
          responseBody: input.responseBody,
          errorMessage: input.errorMessage,
          lastAttemptAt: attemptAt,
          deliveredAt,
          nextAttemptAt,
          deadLetteredAt: willDeadLetter ? attemptAt : null
        }
      });

      await tx.paymentEvent.create({
        data: {
          id: this.createId("evt"),
          organizationId: updatedDelivery.organizationId,
          invoiceId: updatedDelivery.invoiceId,
          paymentId: updatedDelivery.paymentId,
          type:
            updatedDelivery.status === WebhookDeliveryStatus.delivered
              ? PaymentEventType.webhook_delivery_succeeded
              : PaymentEventType.webhook_delivery_failed,
          fromStatus: delivery.paymentStatusSnapshot,
          toStatus: delivery.paymentStatusSnapshot,
          note: this.buildDeliveryNote(
            this.serializeDelivery(updatedDelivery),
            input,
            willDeadLetter
          ),
          payload: {
            deliveryId: updatedDelivery.id,
            eventId: updatedDelivery.eventId,
            eventType: this.toAppEventType(updatedDelivery.eventType),
            destination: updatedDelivery.destination,
            responseStatus: updatedDelivery.responseStatus,
            errorMessage: updatedDelivery.errorMessage,
            attemptCount: updatedDelivery.attemptCount
          },
          createdAt: updatedAt
        }
      });

      return updatedDelivery;
    });

    return this.serializeDelivery(updated);
  }

  private serializeDelivery(delivery: WebhookDeliveryRecord) {
    return {
      ...delivery,
      eventCreatedAt: delivery.eventCreatedAt.toISOString(),
      eventType: this.toAppEventType(delivery.eventType),
      lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
      nextAttemptAt: delivery.nextAttemptAt?.toISOString() ?? null,
      deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
      deadLetteredAt: delivery.deadLetteredAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(),
      updatedAt: delivery.updatedAt.toISOString(),
      diagnostic: buildWebhookDeliveryDiagnostic({
        status: this.toAppDeliveryStatus(delivery.status),
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
        delivery.status === WebhookDeliveryStatus.delivered ||
        delivery.status === WebhookDeliveryStatus.disabled ||
        delivery.status === WebhookDeliveryStatus.dead_letter
    };
  }

  private buildPayload(input: {
    eventId: string;
    eventType: AppWebhookEventType;
    invoice: WebhookPayment["invoice"];
    payment: WebhookPayment;
    observation: WebhookPayment["observation"];
    eventCreatedAt: Date;
  }) {
    return {
      id: input.eventId,
      type: input.eventType,
      version: "2026-04-19",
      createdAt: input.eventCreatedAt.toISOString(),
      livemode: false,
      data: {
        outcome: {
          paymentStatus: input.payment.status,
          invoiceStatus: input.invoice.status,
          matchResult: input.payment.matchResult,
          confirmationSource: input.payment.confirmationSource,
          confirmedAt: input.payment.confirmedAt?.toISOString() ?? null,
          emittedAt: input.eventCreatedAt.toISOString()
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
          confirmationReceivedAt:
            input.payment.confirmationReceivedAt?.toISOString() ?? null,
          confirmedAt: input.payment.confirmedAt?.toISOString() ?? null,
          processingStartedAt:
            input.payment.processingStartedAt?.toISOString() ?? null,
          finalizedAt: input.payment.finalizedAt?.toISOString() ?? null
        },
        invoice: {
          id: input.invoice.id,
          referenceCode: input.invoice.referenceCode,
          publicToken: input.invoice.publicToken,
          status: input.invoice.status,
          amountMinor: input.invoice.amountMinor,
          currency: input.invoice.currency,
          dueAt: input.invoice.dueAt.toISOString()
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
              observedAt: input.observation.observedAt.toISOString(),
              confirmedAt: input.observation.confirmedAt?.toISOString() ?? null
            }
          : null
      }
    };
  }

  private buildDeliveryNote(
    delivery: ReturnType<WebhookDeliveryRepository["serializeDelivery"]>,
    result: {
      status: "disabled" | "delivered" | "failed";
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

    if (delivery.status === WebhookDeliveryStatus.delivered) {
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

  private computeNextAttemptAt(
    attemptAt: Date,
    attemptCount: number,
    baseDelayMs?: number
  ) {
    const delayBase =
      typeof baseDelayMs === "number" &&
      Number.isFinite(baseDelayMs) &&
      baseDelayMs >= 500
        ? Math.floor(baseDelayMs)
        : 5000;
    const delayMs = Math.min(
      delayBase * 2 ** Math.max(attemptCount - 1, 0),
      60_000
    );
    return new Date(attemptAt.getTime() + delayMs);
  }

  private normalizeMaxAttempts(value: number | undefined) {
    const normalized = Number(value ?? 4);
    return Number.isFinite(normalized) && normalized >= 1
      ? Math.floor(normalized)
      : 4;
  }

  private resolveEventTypeForPayment(status: PaymentStatus): AppWebhookEventType {
    if (status === PaymentStatus.finalized) {
      return "payment.finalized";
    }

    if (status === PaymentStatus.failed) {
      return "payment.failed";
    }

    throw new NotFoundException("Only finalized or failed payments can be replayed.");
  }

  private parseIsoDate(value: string, fieldName: string) {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(`${fieldName} must be a valid ISO timestamp.`);
    }

    return new Date(parsed);
  }

  private toPrismaEventType(eventType: AppWebhookEventType) {
    return eventType === "payment.finalized"
      ? WebhookEventType.payment_finalized
      : WebhookEventType.payment_failed;
  }

  private toAppEventType(eventType: WebhookEventType): AppWebhookEventType {
    return eventType === WebhookEventType.payment_finalized
      ? "payment.finalized"
      : "payment.failed";
  }

  private toPrismaDeliveryStatus(
    status: "disabled" | "delivered" | "failed" | "dead_letter"
  ) {
    if (status === "disabled") {
      return WebhookDeliveryStatus.disabled;
    }

    if (status === "delivered") {
      return WebhookDeliveryStatus.delivered;
    }

    if (status === "dead_letter") {
      return WebhookDeliveryStatus.dead_letter;
    }

    return WebhookDeliveryStatus.failed;
  }

  private toAppDeliveryStatus(status: WebhookDeliveryStatus) {
    if (status === WebhookDeliveryStatus.disabled) {
      return "disabled";
    }

    if (status === WebhookDeliveryStatus.delivered) {
      return "delivered";
    }

    if (status === WebhookDeliveryStatus.dead_letter) {
      return "dead_letter";
    }

    return "failed";
  }

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(8).toString("hex")}`;
  }
}
