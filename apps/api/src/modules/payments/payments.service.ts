import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { CurrentAuth } from "../auth/current-auth";
import { PaymentConfirmationService } from "./payment-confirmation.service";
import { PaymentMatchingService } from "./payment-matching.service";
import { RawChainIngestionService } from "./raw-chain-ingestion.service";
import {
  AppChainPaymentObservation,
  AppPayment,
  AppPaymentEvent,
  AppPaymentMatch,
  PaymentStatus,
  StorageService
} from "../storage/storage.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { ArcCanonicalEvent, ArcFinalityEvent } from "../arc/arc.types";
import { WebhookDeliveryRepository } from "../storage/webhook-delivery.repository";
import { WorkspaceReadRepository } from "../storage/workspace-read.repository";
import { buildWebhookDeliveryDiagnostic } from "../storage/webhook-delivery-diagnostics";
import { ArcProviderDiagnostic } from "../arc/arc.types";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly storage: StorageService,
    private readonly paymentConfirmationService: PaymentConfirmationService,
    private readonly paymentMatchingService: PaymentMatchingService,
    private readonly rawChainIngestionService: RawChainIngestionService,
    private readonly webhooksService: WebhooksService,
    private readonly webhookDeliveryRepository: WebhookDeliveryRepository,
    private readonly workspaceReadRepository: WorkspaceReadRepository
  ) {}

  async listByInvoiceId(auth: CurrentAuth, invoiceId: string) {
    if (!auth.organizationId) {
      return [];
    }

    if (this.shouldReadFromPostgres()) {
      return this.workspaceReadRepository.listPaymentsByInvoiceId(
        auth.organizationId,
        invoiceId
      );
    }

    const store = await this.storage.read();
    return this.serializePayments(
      store.payments.filter(
        (payment) =>
          payment.invoiceId === invoiceId && payment.organizationId === auth.organizationId
      ),
      store.paymentEvents,
      store.webhookDeliveries,
      store.chainPaymentObservations,
      store.paymentMatches
    );
  }

  async listWebhookDeliveries(
    auth: CurrentAuth,
    input?: {
      status?: string;
      queue?: "all" | "active" | "dead_letter";
    }
  ) {
    if (!auth.organizationId) {
      return {
        records: [],
        meta: { total: 0, active: 0, deadLetter: 0, disabled: 0, delivered: 0 }
      };
    }

    const statuses = input?.status
      ? input.status
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean) as Array<"disabled" | "delivered" | "failed" | "dead_letter">
      : undefined;

    if (this.shouldWriteWebhooksToPostgres()) {
      return this.webhookDeliveryRepository.listDeliveries({
        organizationId: auth.organizationId,
        statuses,
        queue: input?.queue ?? "all"
      });
    }

    return this.webhooksService.listDeliveries({
      organizationId: auth.organizationId,
      statuses,
      queue: input?.queue ?? "all"
    });
  }

  async getById(auth: CurrentAuth, paymentId: string) {
    if (!auth.organizationId) {
      throw new NotFoundException("Payment not found.");
    }

    if (this.shouldReadFromPostgres()) {
      return this.workspaceReadRepository.getPaymentById(
        auth.organizationId,
        paymentId
      );
    }

    const store = await this.storage.read();
    const payment = store.payments.find(
      (entry) => entry.id === paymentId && entry.organizationId === auth.organizationId
    );

    if (!payment) {
      throw new NotFoundException("Payment not found.");
    }

    return this.serializePayment(
      payment,
      store.paymentEvents,
      store.webhookDeliveries,
      store.chainPaymentObservations,
      store.paymentMatches
    );
  }

  async finalize(
    auth: CurrentAuth,
    paymentId: string,
    input?: { settlementReference?: string }
  ) {
    if (!auth.organizationId) {
      throw new BadRequestException("No organization available for this action.");
    }

    if (this.shouldWriteTerminalPaymentsToPostgres()) {
      const result = await this.workspaceReadRepository.finalizePayment({
        paymentId,
        organizationId: auth.organizationId,
        settlementReference: input?.settlementReference,
        confirmationSource: "admin",
        finalizedNote: "Payment finalized by authenticated admin action."
      });

      return this.dispatchPostgresWebhookIfEnabled(result);
    }

    return this.transitionToFinalized({
      paymentLocator: (payment) =>
        payment.id === paymentId && payment.organizationId === auth.organizationId,
      settlementReference: input?.settlementReference,
      confirmationSource: "admin",
      finalizedNote: "Payment finalized by authenticated admin action."
    });
  }

  async fail(
    auth: CurrentAuth,
    paymentId: string,
    input?: { failureReason?: string }
  ) {
    if (!auth.organizationId) {
      throw new BadRequestException("No organization available for this action.");
    }

    if (this.shouldWriteTerminalPaymentsToPostgres()) {
      const result = await this.workspaceReadRepository.failPayment({
        paymentId,
        organizationId: auth.organizationId,
        failureReason: input?.failureReason,
        failureSource: "admin",
        failedNote: "Payment marked failed by authenticated admin action."
      });

      return this.dispatchPostgresWebhookIfEnabled(result);
    }

    return this.transitionToFailed({
      paymentLocator: (payment) =>
        payment.id === paymentId && payment.organizationId === auth.organizationId,
      failureReason: input?.failureReason,
      failureSource: "admin",
      failedNote: "Payment marked failed by authenticated admin action."
    });
  }

  async ingestMockObservation(input: {
    paymentId?: string;
    publicToken?: string;
    txHash?: string;
    blockNumber?: number;
    from: string;
    to?: string;
    token: string;
    amount: string;
    decimals: number;
    chainId: number;
    rawPayload?: Record<string, unknown>;
  }) {
    if (!input.paymentId && !input.publicToken && !input.to) {
      throw new BadRequestException(
        "Provide paymentId, publicToken, or destination wallet to ingest an observation."
      );
    }

    const txHash = input.txHash?.trim() || this.createMockTxHash();
    const fromAddress = input.from.trim();
    const token = input.token.trim().toUpperCase();
    const amountAtomic = String(input.amount ?? "").trim();
    const toAddress = input.to?.trim() || null;
    const blockNumber = Number(input.blockNumber);
    const decimals = Number(input.decimals);
    const chainId = Number(input.chainId);

    if (!fromAddress || !token || !amountAtomic) {
      throw new BadRequestException("from, token, and amount are required.");
    }

    if (
      !Number.isFinite(blockNumber) ||
      blockNumber <= 0 ||
      !Number.isInteger(blockNumber)
    ) {
      throw new BadRequestException("blockNumber must be a positive integer.");
    }

    if (
      !Number.isFinite(decimals) ||
      decimals < 0 ||
      !Number.isInteger(decimals)
    ) {
      throw new BadRequestException("decimals must be a non-negative integer.");
    }

    if (!Number.isFinite(chainId) || chainId <= 0 || !Number.isInteger(chainId)) {
      throw new BadRequestException("chainId must be a positive integer.");
    }

    if (!/^\d+$/.test(amountAtomic)) {
      throw new BadRequestException("amount must be a base-10 integer string.");
    }

    return this.storage.mutate(async (store) => {
      const existingObservation = store.chainPaymentObservations.find(
        (observation) =>
          observation.chainId === chainId &&
          observation.txHash.toLowerCase() === txHash.toLowerCase()
      );

      if (existingObservation) {
        return {
          deduped: true,
          observation: existingObservation,
          payment:
            existingObservation.paymentId
              ? this.serializePaymentById(store, existingObservation.paymentId)
              : null,
          match:
            store.paymentMatches.find(
              (entry) => entry.observationId === existingObservation.id
            ) ?? null
        };
      }

      const resolvedToAddress = toAddress ?? "";
      const resolution = this.paymentMatchingService.resolveObservationMatch(
        store,
        {
          chainId,
          toAddress: resolvedToAddress,
          token,
          amountAtomic,
          decimals
        },
        {
          paymentId: input.paymentId,
          publicToken: input.publicToken
        }
      );

      if (!resolution.wallet && !toAddress) {
        throw new BadRequestException(
          "Unable to resolve destination wallet for this observation."
        );
      }

      const finalToAddress = toAddress ?? resolution.wallet?.address ?? null;
      if (!finalToAddress) {
        throw new BadRequestException(
          "Unable to resolve destination wallet for this observation."
        );
      }

      const organizationId = resolution.organizationId;
      if (!organizationId) {
        throw new NotFoundException("No organization could be resolved for this observation.");
      }

      const now = new Date().toISOString();
      const observation: AppChainPaymentObservation = {
        id: this.createId("obs"),
        organizationId,
        walletId: resolution.wallet?.id ?? null,
        paymentId: resolution.payment?.id ?? null,
        invoiceId: resolution.invoice?.id ?? null,
        rawChainEventId: null,
        chainId,
        txHash,
        logIndex: 0,
        blockNumber,
        fromAddress,
        toAddress: finalToAddress,
        token,
        amountAtomic,
        decimals,
        status: "detected",
        observedAt: now,
        sourceConfirmedAt: null,
        confirmedAt: null,
        rawPayload: input.rawPayload ?? null,
        createdAt: now,
        updatedAt: now
      };
      store.chainPaymentObservations.push(observation);

      const paymentMatch: AppPaymentMatch = {
        id: this.createId("mtc"),
        organizationId,
        paymentId: resolution.matchResult === "exact" ? resolution.payment?.id ?? null : null,
        invoiceId: resolution.matchResult === "exact" ? resolution.invoice?.id ?? null : null,
        observationId: observation.id,
        matchResult: resolution.matchResult,
        matchReason: resolution.matchReason,
        createdAt: now,
        updatedAt: now
      };
      store.paymentMatches.push(paymentMatch);

      let serializedPayment = null;

      if (resolution.payment && resolution.invoice && resolution.matchResult === "exact") {
        const payment = resolution.payment;
        const invoice = resolution.invoice;
        observation.status = "matched";
        observation.updatedAt = now;
        observation.paymentId = payment.id;
        observation.invoiceId = invoice.id;

        payment.observationId = observation.id;
        payment.matchResult = "exact";
        payment.matchReason = resolution.matchReason;
        payment.token = token;
        payment.amountAtomic = amountAtomic;
        payment.decimals = decimals;
        payment.chainId = chainId;
        payment.txHash = txHash;
        payment.blockNumber = blockNumber;
        payment.fromAddress = fromAddress;
        payment.toAddress = finalToAddress;
        payment.updatedAt = now;

        store.paymentEvents.push(
          this.createEvent({
            organizationId: payment.organizationId,
              invoiceId: payment.invoiceId,
              paymentId: payment.id,
              fromStatus: payment.status,
              toStatus: payment.status,
              type: "payment_match_recorded",
              note: `Payment observation ${txHash} matched exactly to invoice ${invoice.referenceCode}.`
            })
          );

        if (payment.status === "pending") {
          const processingTransition =
            this.paymentConfirmationService.startProcessing({
              payment,
              invoice,
              observation,
              now
            });

          store.paymentEvents.push(
            this.createEvent({
              organizationId: payment.organizationId,
              invoiceId: payment.invoiceId,
              paymentId: payment.id,
              fromStatus: processingTransition.fromStatus,
              toStatus: processingTransition.toStatus,
              type: "payment_processing_started",
              note: "Payment moved to processing after an exact chain observation match."
            })
          );
        }

        serializedPayment = this.serializePayment(
          payment,
          store.paymentEvents,
          store.webhookDeliveries,
          store.chainPaymentObservations,
          store.paymentMatches
        );
      } else if (resolution.candidates.length === 1) {
        const payment = resolution.candidates[0].payment;
        payment.matchResult = paymentMatch.matchResult;
        payment.matchReason = paymentMatch.matchReason;
        payment.updatedAt = now;
        serializedPayment = this.serializePayment(
          payment,
          store.paymentEvents,
          store.webhookDeliveries,
          store.chainPaymentObservations,
          store.paymentMatches
        );
      }

      return {
        deduped: false,
        observation,
        payment: serializedPayment,
        match: paymentMatch
      };
    });
  }

  async ingestMockRawChainEvent(input: {
    txHash?: string;
    logIndex?: number;
    blockNumber?: number;
    blockTimestamp?: string;
    confirmedAt?: string;
    from: string;
    to: string;
    token: string;
    amount: string;
    decimals: number;
    chainId: number;
    rawPayload?: Record<string, unknown>;
  }) {
    if (this.shouldWriteMatchingToPostgres()) {
      return this.ingestRawChainEventToPostgres(input);
    }

    const ingestion = await this.rawChainIngestionService.ingestRawEvent(input);

    if (!ingestion.observation) {
      return {
        ...ingestion,
        payment: null,
        paymentMatch: ingestion.paymentMatch ?? null,
        match: ingestion.paymentMatch ?? null
      };
    }

    const matched = await this.matchStoredObservation({
      observationId: ingestion.observation.id
    });

    return {
      ...ingestion,
      observation: matched.observation,
      payment: matched.payment,
      paymentMatch: matched.match,
      match: matched.match
    };
  }

  async ingestArcCanonicalEvent(input: ArcCanonicalEvent) {
    if (this.shouldWriteMatchingToPostgres()) {
      return this.ingestRawChainEventToPostgres({
        txHash: input.txHash,
        logIndex: input.logIndex,
        blockNumber: input.blockNumber,
        blockTimestamp: input.blockTimestamp ?? undefined,
        confirmedAt: input.confirmedAt,
        from: input.from,
        to: input.to,
        token: input.token,
        amount: input.amount,
        decimals: input.decimals,
        chainId: input.chainId,
        rawPayload: {
          ...(input.rawPayload ?? {}),
          _stablebooks: {
            source: "arc_adapter",
            confirmedAt: input.confirmedAt
          }
        }
      });
    }

    const ingestion = await this.rawChainIngestionService.ingestRawEvent({
      txHash: input.txHash,
      logIndex: input.logIndex,
      blockNumber: input.blockNumber,
      blockTimestamp: input.blockTimestamp ?? undefined,
      confirmedAt: input.confirmedAt,
      from: input.from,
      to: input.to,
      token: input.token,
      amount: input.amount,
      decimals: input.decimals,
      chainId: input.chainId,
      rawPayload: {
        ...(input.rawPayload ?? {}),
        _stablebooks: {
          source: "arc_adapter",
          confirmedAt: input.confirmedAt
        }
      }
    });

    if (!ingestion.observation) {
      return {
        ...ingestion,
        payment: null,
        paymentMatch: ingestion.paymentMatch ?? null,
        match: ingestion.paymentMatch ?? null
      };
    }

    const matched = await this.matchStoredObservation({
      observationId: ingestion.observation.id
    });

    return {
      ...ingestion,
      observation: matched.observation,
      payment: matched.payment,
      paymentMatch: matched.match,
      match: matched.match
    };
  }

  async matchStoredObservation(input: {
    observationId: string;
    paymentId?: string;
    publicToken?: string;
  }) {
    if (this.shouldWriteMatchingToPostgres()) {
      return this.workspaceReadRepository.matchStoredObservation({
        observationId: input.observationId,
        matchId: this.createId("mtc"),
        paymentId: input.paymentId,
        publicToken: input.publicToken
      });
    }

    return this.storage.mutate(async (store) => {
      const observation = store.chainPaymentObservations.find(
        (entry) => entry.id === input.observationId
      );

      if (!observation) {
        throw new NotFoundException("Observation not found.");
      }

      const paymentMatch =
        store.paymentMatches.find((entry) => entry.observationId === observation.id) ?? null;

      const resolution = this.paymentMatchingService.resolveObservationMatch(
        store,
        {
          chainId: observation.chainId,
          toAddress: observation.toAddress,
          token: observation.token,
          amountAtomic: observation.amountAtomic,
          decimals: observation.decimals
        },
        {
          paymentId: input.paymentId,
          publicToken: input.publicToken
        }
      );

      const now = new Date().toISOString();
      const appliedMatch =
        paymentMatch ??
        ({
          id: this.createId("mtc"),
          organizationId: observation.organizationId,
          paymentId: null,
          invoiceId: null,
          observationId: observation.id,
          matchResult: "pending",
          matchReason: "Match evaluation has not been run yet.",
          createdAt: now,
          updatedAt: now
        } satisfies AppPaymentMatch);

      if (!paymentMatch) {
        store.paymentMatches.push(appliedMatch);
      }

      this.detachObservationLinkIfNeeded(store, observation.id, resolution.payment?.id ?? null, now);

      appliedMatch.organizationId = resolution.organizationId ?? observation.organizationId;
      appliedMatch.matchResult = resolution.matchResult;
      appliedMatch.matchReason = resolution.matchReason;
      appliedMatch.updatedAt = now;

      let serializedPayment = null;

      if (resolution.payment && resolution.invoice && resolution.matchResult === "exact") {
        const payment = resolution.payment;
        const invoice = resolution.invoice;

        observation.status = "matched";
        observation.paymentId = payment.id;
        observation.invoiceId = invoice.id;
        observation.updatedAt = now;

        appliedMatch.paymentId = payment.id;
        appliedMatch.invoiceId = invoice.id;

        payment.observationId = observation.id;
        payment.matchResult = "exact";
        payment.matchReason = resolution.matchReason;
        payment.token = observation.token;
        payment.amountAtomic = observation.amountAtomic;
        payment.decimals = observation.decimals;
        payment.chainId = observation.chainId;
        payment.txHash = observation.txHash;
        payment.blockNumber = observation.blockNumber;
        payment.sourceConfirmedAt = observation.sourceConfirmedAt;
        payment.fromAddress = observation.fromAddress;
        payment.toAddress = observation.toAddress;
        payment.updatedAt = now;

        const exactMatchNote = `Payment observation ${observation.txHash} matched exactly to invoice ${invoice.referenceCode}.`;
        if (
          !store.paymentEvents.some(
            (event) =>
              event.paymentId === payment.id &&
              event.type === "payment_match_recorded" &&
              event.note === exactMatchNote
          )
        ) {
          store.paymentEvents.push(
            this.createEvent({
              organizationId: payment.organizationId,
              invoiceId: payment.invoiceId,
              paymentId: payment.id,
              fromStatus: payment.status,
              toStatus: payment.status,
              type: "payment_match_recorded",
              note: exactMatchNote
            })
          );
        }

        if (payment.status === "pending") {
          const processingTransition =
            this.paymentConfirmationService.startProcessing({
              payment,
              invoice,
              observation,
              now
            });

          if (processingTransition.changed) {
            store.paymentEvents.push(
              this.createEvent({
                organizationId: payment.organizationId,
                invoiceId: payment.invoiceId,
                paymentId: payment.id,
                fromStatus: processingTransition.fromStatus,
                toStatus: processingTransition.toStatus,
                type: "payment_processing_started",
                note: "Payment moved to processing after an exact observation match."
              })
            );
          }
        }

        serializedPayment = this.serializePayment(
          payment,
          store.paymentEvents,
          store.webhookDeliveries,
          store.chainPaymentObservations,
          store.paymentMatches
        );
      } else {
        observation.status = resolution.matchResult === "rejected" ? "rejected" : "detected";
        observation.paymentId = null;
        observation.invoiceId = null;
        observation.updatedAt = now;

        appliedMatch.paymentId = null;
        appliedMatch.invoiceId = null;

        if (resolution.candidates.length === 1) {
          const payment = resolution.candidates[0].payment;
          payment.matchResult = resolution.matchResult;
          payment.matchReason = resolution.matchReason;
          payment.updatedAt = now;

          serializedPayment = this.serializePayment(
            payment,
            store.paymentEvents,
            store.webhookDeliveries,
            store.chainPaymentObservations,
            store.paymentMatches
          );
        }
      }

      return {
        observation,
        payment: serializedPayment,
        match: appliedMatch
      };
    });
  }

  async confirmMatchedObservation(input: {
    observationId: string;
    settlementReference?: string;
  }) {
    if (this.shouldWriteTerminalPaymentsToPostgres()) {
      const result = await this.workspaceReadRepository.finalizePayment({
        observationId: input.observationId,
        settlementReference: input.settlementReference,
        confirmationSource: "arc_ingestion",
        confirmationNote: `Arc ingestion confirmation accepted for observation ${input.observationId}.`,
        finalizedNote: "Payment finalized from the arc_ingestion confirmation flow."
      });

      return this.dispatchPostgresWebhookIfEnabled(result);
    }

    const store = await this.storage.read();
    const observation = store.chainPaymentObservations.find(
      (entry) => entry.id === input.observationId
    );

    if (!observation) {
      throw new NotFoundException("Observation not found.");
    }

    if (!observation.paymentId) {
      throw new BadRequestException(
        "Only matched observations linked to a payment can be confirmed."
      );
    }

    const paymentMatch =
      store.paymentMatches.find((entry) => entry.observationId === observation.id) ?? null;
    if (paymentMatch?.matchResult !== "exact") {
      throw new BadRequestException("Only exact matched observations can be confirmed.");
    }

    return this.transitionToFinalized({
      paymentLocator: (payment) => payment.id === observation.paymentId,
      settlementReference: input.settlementReference,
      confirmationSource: "arc_ingestion",
      confirmationTxHash: observation.txHash,
      confirmationBlockNumber: observation.blockNumber,
      sourceConfirmedAt: observation.sourceConfirmedAt ?? undefined,
      confirmationNote: observation.sourceConfirmedAt
        ? `Arc ingestion confirmation accepted for observation ${observation.id} (sourceConfirmedAt ${observation.sourceConfirmedAt}).`
        : `Arc ingestion confirmation accepted for observation ${observation.id}.`,
      finalizedNote: "Payment finalized from the arc_ingestion confirmation flow."
    });
  }

  async failMatchedObservation(input: {
    observationId: string;
    failureReason?: string;
  }) {
    if (this.shouldWriteTerminalPaymentsToPostgres()) {
      const result = await this.workspaceReadRepository.failPayment({
        observationId: input.observationId,
        failureReason: input.failureReason,
        failureSource: "arc_ingestion",
        failureNote: `Arc ingestion rejection accepted for observation ${input.observationId}.`,
        failedNote: "Payment marked failed from the arc_ingestion confirmation flow."
      });

      return this.dispatchPostgresWebhookIfEnabled(result);
    }

    const store = await this.storage.read();
    const observation = store.chainPaymentObservations.find(
      (entry) => entry.id === input.observationId
    );

    if (!observation) {
      throw new NotFoundException("Observation not found.");
    }

    if (!observation.paymentId) {
      throw new BadRequestException(
        "Only matched observations linked to a payment can drive a failure path."
      );
    }

    const paymentMatch =
      store.paymentMatches.find((entry) => entry.observationId === observation.id) ?? null;
    if (paymentMatch?.matchResult !== "exact") {
      throw new BadRequestException("Only exact matched observations can be failed.");
    }

    return this.transitionToFailed({
      paymentLocator: (payment) => payment.id === observation.paymentId,
      failureReason: input.failureReason,
      failureSource: "arc_ingestion",
      confirmationTxHash: observation.txHash,
      confirmationBlockNumber: observation.blockNumber,
      sourceConfirmedAt: observation.sourceConfirmedAt ?? undefined,
      failureNote: observation.sourceConfirmedAt
        ? `Arc ingestion rejection accepted for observation ${observation.id} (sourceConfirmedAt ${observation.sourceConfirmedAt}).`
        : `Arc ingestion rejection accepted for observation ${observation.id}.`,
      failedNote: "Payment marked failed from the arc_ingestion confirmation flow."
    });
  }

  async confirmArcFinalityEvent(input: ArcFinalityEvent) {
    if (this.shouldWriteTerminalPaymentsToPostgres()) {
      const observation =
        await this.workspaceReadRepository.refreshObservationFromArcFinality({
          chainId: input.chainId,
          txHash: input.txHash,
          logIndex: input.logIndex,
          blockNumber: input.blockNumber,
          confirmedAt: input.confirmedAt
        });

      const result = await this.workspaceReadRepository.finalizePayment({
        observationId: observation.id,
        settlementReference: input.settlementReference,
        confirmationSource: "arc_ingestion",
        confirmationTxHash: input.txHash,
        confirmationBlockNumber: input.blockNumber,
        sourceConfirmedAt: input.confirmedAt,
        confirmationNote: input.confirmedAt
          ? `Arc ingestion confirmation accepted for observation ${observation.id} (sourceConfirmedAt ${input.confirmedAt}).`
          : `Arc ingestion confirmation accepted for observation ${observation.id}.`,
        finalizedNote: "Payment finalized from the arc_ingestion confirmation flow."
      });

      return this.dispatchPostgresWebhookIfEnabled(result);
    }

    const observation = await this.refreshObservationFromArcFinality(input);

    return this.confirmMatchedObservation({
      observationId: observation.id,
      settlementReference: input.settlementReference
    });
  }

  async failArcFinalityEvent(input: ArcFinalityEvent) {
    if (this.shouldWriteTerminalPaymentsToPostgres()) {
      const observation =
        await this.workspaceReadRepository.refreshObservationFromArcFinality({
          chainId: input.chainId,
          txHash: input.txHash,
          logIndex: input.logIndex,
          blockNumber: input.blockNumber,
          confirmedAt: input.confirmedAt
        });

      const result = await this.workspaceReadRepository.failPayment({
        observationId: observation.id,
        failureReason: input.failureReason,
        failureSource: "arc_ingestion",
        confirmationTxHash: input.txHash,
        confirmationBlockNumber: input.blockNumber,
        sourceConfirmedAt: input.confirmedAt,
        failureNote: input.confirmedAt
          ? `Arc ingestion rejection accepted for observation ${observation.id} (sourceConfirmedAt ${input.confirmedAt}).`
          : `Arc ingestion rejection accepted for observation ${observation.id}.`,
        failedNote: "Payment marked failed from the arc_ingestion confirmation flow."
      });

      return this.dispatchPostgresWebhookIfEnabled(result);
    }

    const observation = await this.refreshObservationFromArcFinality(input);

    return this.failMatchedObservation({
      observationId: observation.id,
      failureReason: input.failureReason
    });
  }

  async confirmFromMockChain(input: {
    paymentId?: string;
    publicToken?: string;
    txHash?: string;
    blockNumber?: number;
    settlementReference?: string;
  }) {
    if (!input.paymentId && !input.publicToken) {
      throw new BadRequestException("Provide paymentId or publicToken for chain confirmation.");
    }

    const blockNumber =
      typeof input.blockNumber === "number"
        ? input.blockNumber
        : input.blockNumber
          ? Number(input.blockNumber)
          : undefined;

    if (blockNumber !== undefined && (!Number.isFinite(blockNumber) || blockNumber <= 0)) {
      throw new BadRequestException("blockNumber must be a positive integer.");
    }

    const txHash = input.txHash?.trim() || this.createMockTxHash();

    if (this.shouldWriteTerminalPaymentsToPostgres()) {
      const result = await this.workspaceReadRepository.finalizePayment({
        paymentId: input.paymentId,
        publicToken: input.publicToken,
        settlementReference: input.settlementReference,
        confirmationSource: "mock_chain",
        confirmationTxHash: txHash,
        confirmationBlockNumber: blockNumber ?? this.createMockBlockNumber(),
        confirmationNote: `Mock chain confirmation received for tx ${txHash}.`,
        finalizedNote: "Payment finalized after mock chain confirmation."
      });

      return this.dispatchPostgresWebhookIfEnabled(result);
    }

    return this.transitionToFinalized({
      paymentLocator: (payment, store) => {
        if (input.paymentId) {
          return payment.id === input.paymentId;
        }

        const latestForToken = store.payments
          .filter((entry) => entry.publicToken === input.publicToken)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

        return latestForToken ? payment.id === latestForToken.id : false;
      },
      settlementReference: input.settlementReference,
      confirmationSource: "mock_chain",
      confirmationTxHash: txHash,
      confirmationBlockNumber: blockNumber ?? this.createMockBlockNumber(),
      confirmationNote: `Mock chain confirmation received for tx ${txHash}.`,
      finalizedNote: "Payment finalized after mock chain confirmation."
    });
  }

  async failFromMockChain(input: {
    paymentId?: string;
    publicToken?: string;
    txHash?: string;
    blockNumber?: number;
    failureReason?: string;
  }) {
    if (!input.paymentId && !input.publicToken) {
      throw new BadRequestException("Provide paymentId or publicToken for chain failure.");
    }

    const blockNumber =
      typeof input.blockNumber === "number"
        ? input.blockNumber
        : input.blockNumber
          ? Number(input.blockNumber)
          : undefined;

    if (blockNumber !== undefined && (!Number.isFinite(blockNumber) || blockNumber <= 0)) {
      throw new BadRequestException("blockNumber must be a positive integer.");
    }

    const txHash = input.txHash?.trim() || this.createMockTxHash();

    if (this.shouldWriteTerminalPaymentsToPostgres()) {
      const result = await this.workspaceReadRepository.failPayment({
        paymentId: input.paymentId,
        publicToken: input.publicToken,
        failureReason: input.failureReason,
        failureSource: "mock_chain",
        confirmationTxHash: txHash,
        confirmationBlockNumber: blockNumber ?? this.createMockBlockNumber(),
        failureNote: `Mock chain failure received for tx ${txHash}.`,
        failedNote: "Payment marked failed after mock chain failure."
      });

      return this.dispatchPostgresWebhookIfEnabled(result);
    }

    return this.transitionToFailed({
      paymentLocator: (payment, store) => {
        if (input.paymentId) {
          return payment.id === input.paymentId;
        }

        const latestForToken = store.payments
          .filter((entry) => entry.publicToken === input.publicToken)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

        return latestForToken ? payment.id === latestForToken.id : false;
      },
      failureReason: input.failureReason,
      failureSource: "mock_chain",
      confirmationTxHash: txHash,
      confirmationBlockNumber: blockNumber ?? this.createMockBlockNumber(),
      failureNote: `Mock chain failure received for tx ${txHash}.`,
      failedNote: "Payment marked failed after mock chain failure."
    });
  }

  async retryWebhookDelivery(auth: CurrentAuth, deliveryId: string) {
    if (!auth.organizationId) {
      throw new BadRequestException("No organization available for this action.");
    }

    if (this.shouldWriteWebhooksToPostgres()) {
      return this.webhooksService.retryPostgresDelivery({
        deliveryId,
        organizationId: auth.organizationId
      });
    }

    return this.webhooksService.retryDelivery({
      deliveryId,
      organizationId: auth.organizationId
    });
  }

  async replayWebhook(auth: CurrentAuth, paymentId: string) {
    if (!auth.organizationId) {
      throw new BadRequestException("No organization available for this action.");
    }

    if (this.shouldWriteWebhooksToPostgres()) {
      return this.webhooksService.replayPostgresPaymentEvent({
        organizationId: auth.organizationId,
        paymentId
      });
    }

    const store = await this.storage.read();
    const payment = store.payments.find(
      (entry) => entry.id === paymentId && entry.organizationId === auth.organizationId
    );
    if (!payment) {
      throw new NotFoundException("Payment not found.");
    }

    const invoice = store.invoices.find((entry) => entry.id === payment.invoiceId);
    if (!invoice) {
      throw new NotFoundException("Invoice not found for this payment.");
    }

    return this.webhooksService.replayPaymentEvent({
      organizationId: auth.organizationId,
      invoice,
      payment
    });
  }

  createPendingPayment(
    input: {
      organizationId: string;
      invoiceId: string;
      publicToken: string;
      amountMinor: number;
      currency: string;
    },
    store: Awaited<ReturnType<StorageService["read"]>>
  ) {
    const now = new Date().toISOString();
    const payment: AppPayment = {
      id: this.createId("pay"),
      organizationId: input.organizationId,
      invoiceId: input.invoiceId,
      publicToken: input.publicToken,
      status: "pending",
      matchResult: "pending",
      matchReason: null,
      observationId: null,
      amountMinor: input.amountMinor,
      currency: input.currency,
      token: null,
      amountAtomic: null,
      decimals: null,
      chainId: null,
      txHash: null,
      blockNumber: null,
      fromAddress: null,
      toAddress: null,
      settlementReference: null,
      failureReason: null,
      confirmationSource: null,
      confirmationTxHash: null,
      confirmationBlockNumber: null,
      sourceConfirmedAt: null,
      confirmationReceivedAt: null,
      confirmedAt: null,
      startedAt: now,
      processingStartedAt: null,
      finalizedAt: null,
      createdAt: now,
      updatedAt: now
    };

    store.payments.push(payment);
    store.paymentEvents.push(
      this.createEvent({
        organizationId: input.organizationId,
        invoiceId: input.invoiceId,
        paymentId: payment.id,
        fromStatus: null,
        toStatus: payment.status,
        type: "payment_session_created",
        note: "Hosted payment session created."
      })
    );

    return payment;
  }

  getLatestPaymentForInvoice(
    store: Awaited<ReturnType<StorageService["read"]>>,
    invoiceId: string
  ) {
    return (
      store.payments
        .filter((payment) => payment.invoiceId === invoiceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }

  buildTimeline(
    store: Awaited<ReturnType<StorageService["read"]>>,
    invoiceId: string
  ) {
    return store.paymentEvents
      .filter((event) => event.invoiceId === invoiceId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((event) => ({
        id: event.id,
        type: event.type,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        createdAt: event.createdAt,
        paymentId: event.paymentId
      }));
  }

  private serializePayments(
    payments: AppPayment[],
    events: AppPaymentEvent[],
    webhookDeliveries: Awaited<ReturnType<StorageService["read"]>>["webhookDeliveries"],
    observations: Awaited<ReturnType<StorageService["read"]>>["chainPaymentObservations"],
    paymentMatches: Awaited<ReturnType<StorageService["read"]>>["paymentMatches"]
  ) {
    return payments
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((payment) =>
        this.serializePayment(
          payment,
          events,
          webhookDeliveries,
          observations,
          paymentMatches
        )
      );
  }

  private serializePayment(
    payment: AppPayment,
    events: AppPaymentEvent[],
    webhookDeliveries: Awaited<ReturnType<StorageService["read"]>>["webhookDeliveries"],
    observations: Awaited<ReturnType<StorageService["read"]>>["chainPaymentObservations"],
    paymentMatches: Awaited<ReturnType<StorageService["read"]>>["paymentMatches"]
  ) {
    const observation =
      observations.find((entry) => entry.id === payment.observationId) ?? null;
    const match =
      payment.observationId
        ? paymentMatches.find((entry) => entry.observationId === payment.observationId) ?? null
        : null;

    return {
      ...payment,
      observation,
      providerDiagnostic: this.buildProviderDiagnostic(observation),
      paymentMatch: match,
      events: events
        .filter((event) => event.paymentId === payment.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      webhookDeliveries: webhookDeliveries
        .filter((delivery) => delivery.paymentId === payment.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((delivery) => ({
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
          })
        }))
    };
  }

  private serializePaymentById(
    store: Awaited<ReturnType<StorageService["read"]>>,
    paymentId: string
  ) {
    const payment = store.payments.find((entry) => entry.id === paymentId);
    if (!payment) {
      return null;
    }

    return this.serializePayment(
      payment,
      store.paymentEvents,
      store.webhookDeliveries,
      store.chainPaymentObservations,
      store.paymentMatches
    );
  }

  private buildProviderDiagnostic(
    observation: AppChainPaymentObservation | null
  ): ArcProviderDiagnostic | null {
    const rawPayload = observation?.rawPayload;
    if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
      return null;
    }

    const diagnostic = rawPayload.stablebooksProviderDiagnostic;
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
      return null;
    }

    const candidate = diagnostic as Partial<ArcProviderDiagnostic>;
    if (
      (candidate.boundaryKind !== "canonical" &&
        candidate.boundaryKind !== "circle_event_monitor") ||
      (candidate.sourceKind !== "rpc_polling" &&
        candidate.sourceKind !== "indexer_polling" &&
        candidate.sourceKind !== "webhook" &&
        candidate.sourceKind !== "fixtures")
    ) {
      return null;
    }

    return {
      boundaryKind: candidate.boundaryKind,
      sourceKind: candidate.sourceKind,
      sourceProfileMatched:
        typeof candidate.sourceProfileMatched === "boolean"
          ? candidate.sourceProfileMatched
          : null,
      providerWarnings: Array.isArray(candidate.providerWarnings)
        ? candidate.providerWarnings.filter((entry) => typeof entry === "string")
        : [],
      rejectedReason:
        typeof candidate.rejectedReason === "string"
          ? candidate.rejectedReason
          : null
    };
  }

  private createEvent(input: {
    organizationId: string;
    invoiceId: string;
    paymentId: string;
    type: AppPaymentEvent["type"];
    fromStatus: PaymentStatus | null;
    toStatus: PaymentStatus;
    note: string;
  }): AppPaymentEvent {
    return {
      id: this.createId("evt"),
      organizationId: input.organizationId,
      invoiceId: input.invoiceId,
      paymentId: input.paymentId,
      type: input.type,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      note: input.note,
      createdAt: new Date().toISOString()
    };
  }

  private createSettlementReference() {
    return `settle_${randomBytes(6).toString("hex")}`;
  }

  private async refreshObservationFromArcFinality(input: ArcFinalityEvent) {
    return this.storage.mutate(async (store) => {
      const observation = this.findObservationByArcLocator(store, {
        chainId: input.chainId,
        txHash: input.txHash,
        logIndex: input.logIndex
      });
      const now = new Date().toISOString();

      if (
        typeof input.blockNumber === "number" &&
        Number.isInteger(input.blockNumber) &&
        input.blockNumber > 0
      ) {
        observation.blockNumber = input.blockNumber;
      }

      if (input.confirmedAt) {
        observation.sourceConfirmedAt = input.confirmedAt;
      }

      observation.updatedAt = now;

      if (observation.rawChainEventId) {
        const rawEvent = store.rawChainEvents.find(
          (entry) => entry.id === observation.rawChainEventId
        );

        if (rawEvent) {
          rawEvent.blockNumber = observation.blockNumber;
          rawEvent.sourceConfirmedAt = observation.sourceConfirmedAt;
          rawEvent.updatedAt = now;
        }
      }

      if (observation.paymentId) {
        const payment = store.payments.find((entry) => entry.id === observation.paymentId);

        if (payment) {
          payment.blockNumber = observation.blockNumber;
          payment.sourceConfirmedAt = observation.sourceConfirmedAt;
          payment.updatedAt = now;
        }
      }

      return { ...observation };
    });
  }

  private detachObservationLinkIfNeeded(
    store: Awaited<ReturnType<StorageService["read"]>>,
    observationId: string,
    keepPaymentId: string | null,
    now: string
  ) {
    store.payments
      .filter((payment) => payment.observationId === observationId)
      .filter((payment) => payment.id !== keepPaymentId)
      .forEach((payment) => {
        payment.observationId = null;
        payment.matchResult = "pending";
        payment.matchReason = null;
        payment.token = null;
        payment.amountAtomic = null;
        payment.decimals = null;
        payment.chainId = null;
        payment.txHash = null;
        payment.blockNumber = null;
        payment.sourceConfirmedAt = null;
        payment.fromAddress = null;
        payment.toAddress = null;
        payment.updatedAt = now;
      });
  }

  private findObservationByArcLocator(
    store: Awaited<ReturnType<StorageService["read"]>>,
    input: {
      chainId: number;
      txHash: string;
      logIndex?: number;
    }
  ) {
    const sameTx = store.chainPaymentObservations.filter(
      (observation) =>
        observation.chainId === input.chainId &&
        observation.txHash.toLowerCase() === input.txHash.toLowerCase()
    );

    if (!sameTx.length) {
      throw new NotFoundException("Arc observation not found for the provided locator.");
    }

    if (typeof input.logIndex === "number") {
      const exact = sameTx.find((observation) => observation.logIndex === input.logIndex);
      if (!exact) {
        throw new NotFoundException("Arc observation not found for the provided locator.");
      }

      return exact;
    }

    if (sameTx.length > 1) {
      throw new BadRequestException(
        "Multiple Arc observations share this txHash. Provide logIndex for finality."
      );
    }

    return sameTx[0];
  }

  private async transitionToFinalized(input: {
    paymentLocator: (
      payment: AppPayment,
      store: Awaited<ReturnType<StorageService["read"]>>
    ) => boolean;
    settlementReference?: string;
    confirmationSource: "admin" | "mock_chain" | "arc_ingestion";
    confirmationTxHash?: string;
    confirmationBlockNumber?: number;
    sourceConfirmedAt?: string;
    confirmationNote?: string;
    finalizedNote: string;
  }) {
    const result = await this.storage.mutate(async (store) => {
      const payment = store.payments.find((entry) => input.paymentLocator(entry, store));

      if (!payment) {
        throw new NotFoundException("Payment not found.");
      }

      const invoice = store.invoices.find((entry) => entry.id === payment.invoiceId);
      if (!invoice) {
        throw new NotFoundException("Invoice not found for this payment.");
      }

      if (payment.status === "finalized") {
        return {
          changed: false,
          payment: { ...payment },
          invoice: { ...invoice },
          serialized: this.serializePayment(
            payment,
            store.paymentEvents,
            store.webhookDeliveries,
            store.chainPaymentObservations,
            store.paymentMatches
          )
        };
      }

      const now = new Date().toISOString();
      const observation =
        payment.observationId
          ? store.chainPaymentObservations.find(
              (entry) => entry.id === payment.observationId
            ) ?? null
          : null;

      if (input.confirmationNote) {
        store.paymentEvents.push(
          this.createEvent({
            organizationId: payment.organizationId,
            invoiceId: payment.invoiceId,
            paymentId: payment.id,
            fromStatus: payment.status,
            toStatus: payment.status,
            type: "payment_confirmation_received",
            note: input.confirmationNote
          })
        );
      }

      const transition = this.paymentConfirmationService.finalize({
        payment,
        invoice,
        observation,
        now,
        confirmationSource: input.confirmationSource,
        settlementReference:
          input.settlementReference?.trim() || this.createSettlementReference(),
        confirmationTxHash: input.confirmationTxHash,
        confirmationBlockNumber: input.confirmationBlockNumber,
        sourceConfirmedAt: input.sourceConfirmedAt
      });

      if (transition.processingTransition?.changed) {
        store.paymentEvents.push(
          this.createEvent({
            organizationId: payment.organizationId,
            invoiceId: payment.invoiceId,
            paymentId: payment.id,
            fromStatus: transition.processingTransition.fromStatus,
            toStatus: transition.processingTransition.toStatus,
            type: "payment_processing_started",
            note: "Payment moved to processing before final confirmation was accepted."
          })
        );
      }

      store.paymentEvents.push(
        this.createEvent({
          organizationId: payment.organizationId,
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          fromStatus: transition.fromStatus,
          toStatus: transition.toStatus,
          type: "payment_finalized",
          note: input.finalizedNote
        })
      );

      return {
        changed: true,
        payment: { ...payment },
        invoice: { ...invoice },
        serialized: this.serializePayment(
          payment,
          store.paymentEvents,
          store.webhookDeliveries,
          store.chainPaymentObservations,
          store.paymentMatches
        )
      };
    });

    if (result.changed) {
      await this.webhooksService.dispatchPaymentFinalized({
        payment: result.payment,
        invoice: result.invoice
      });

      const store = await this.storage.read();
      const payment = store.payments.find((entry) => entry.id === result.payment.id);
      if (!payment) {
        throw new NotFoundException("Payment not found after finalization.");
      }

      return this.serializePayment(
        payment,
        store.paymentEvents,
        store.webhookDeliveries,
        store.chainPaymentObservations,
        store.paymentMatches
      );
    }

    return result.serialized;
  }

  private async transitionToFailed(input: {
    paymentLocator: (
      payment: AppPayment,
      store: Awaited<ReturnType<StorageService["read"]>>
    ) => boolean;
    failureReason?: string;
    failureSource: "admin" | "mock_chain" | "arc_ingestion";
    confirmationTxHash?: string;
    confirmationBlockNumber?: number;
    sourceConfirmedAt?: string;
    failureNote?: string;
    failedNote: string;
  }) {
    const result = await this.storage.mutate(async (store) => {
      const payment = store.payments.find((entry) => input.paymentLocator(entry, store));

      if (!payment) {
        throw new NotFoundException("Payment not found.");
      }

      const invoice = store.invoices.find((entry) => entry.id === payment.invoiceId);
      if (!invoice) {
        throw new NotFoundException("Invoice not found for this payment.");
      }

      if (payment.status === "failed") {
        return {
          changed: false,
          payment: { ...payment },
          invoice: { ...invoice },
          serialized: this.serializePayment(
            payment,
            store.paymentEvents,
            store.webhookDeliveries,
            store.chainPaymentObservations,
            store.paymentMatches
          )
        };
      }

      const now = new Date().toISOString();
      const observation =
        payment.observationId
          ? store.chainPaymentObservations.find(
              (entry) => entry.id === payment.observationId
            ) ?? null
          : null;

      if (input.failureNote) {
        store.paymentEvents.push(
          this.createEvent({
            organizationId: payment.organizationId,
            invoiceId: payment.invoiceId,
            paymentId: payment.id,
            fromStatus: payment.status,
            toStatus: payment.status,
            type: "payment_failure_received",
            note: input.failureNote
          })
        );
      }

      const transition = this.paymentConfirmationService.fail({
        payment,
        invoice,
        observation,
        now,
        failureSource: input.failureSource,
        failureReason:
          input.failureReason?.trim() || "Settlement could not be completed.",
        confirmationTxHash: input.confirmationTxHash,
        confirmationBlockNumber: input.confirmationBlockNumber,
        sourceConfirmedAt: input.sourceConfirmedAt
      });

      if (transition.processingTransition?.changed) {
        store.paymentEvents.push(
          this.createEvent({
            organizationId: payment.organizationId,
            invoiceId: payment.invoiceId,
            paymentId: payment.id,
            fromStatus: transition.processingTransition.fromStatus,
            toStatus: transition.processingTransition.toStatus,
            type: "payment_processing_started",
            note: "Payment moved to processing before the settlement attempt was rejected."
          })
        );
      }

      store.paymentEvents.push(
        this.createEvent({
          organizationId: payment.organizationId,
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          fromStatus: transition.fromStatus,
          toStatus: transition.toStatus,
          type: "payment_failed",
          note: input.failedNote
        })
      );

      return {
        changed: true,
        payment: { ...payment },
        invoice: { ...invoice },
        serialized: this.serializePayment(
          payment,
          store.paymentEvents,
          store.webhookDeliveries,
          store.chainPaymentObservations,
          store.paymentMatches
        )
      };
    });

    if (result.changed) {
      await this.webhooksService.dispatchPaymentFailed({
        payment: result.payment,
        invoice: result.invoice
      });

      const store = await this.storage.read();
      const payment = store.payments.find((entry) => entry.id === result.payment.id);
      if (!payment) {
        throw new NotFoundException("Payment not found after failure transition.");
      }

      return this.serializePayment(
        payment,
        store.paymentEvents,
        store.webhookDeliveries,
        store.chainPaymentObservations,
        store.paymentMatches
      );
    }

    return result.serialized;
  }

  private createMockTxHash() {
    return `0x${randomBytes(32).toString("hex")}`;
  }

  private async ingestRawChainEventToPostgres(input: {
    txHash?: string;
    logIndex?: number;
    blockNumber?: number;
    blockTimestamp?: string;
    confirmedAt?: string;
    from: string;
    to: string;
    token: string;
    amount: string;
    decimals: number;
    chainId: number;
    rawPayload?: Record<string, unknown>;
  }) {
    const ingestion = await this.workspaceReadRepository.ingestRawChainEvent({
      rawEventId: this.createId("rce"),
      observationId: this.createId("obs"),
      txHash: input.txHash?.trim() || this.createMockTxHash(),
      logIndex: input.logIndex,
      blockNumber: input.blockNumber ?? this.createMockBlockNumber(),
      blockTimestamp: input.blockTimestamp,
      confirmedAt: input.confirmedAt,
      from: input.from,
      to: input.to,
      token: input.token,
      amount: input.amount,
      decimals: input.decimals,
      chainId: input.chainId,
      rawPayload: input.rawPayload
    });

    if (!ingestion.observation) {
      return {
        ...ingestion,
        payment: null,
        paymentMatch: ingestion.paymentMatch ?? null,
        match: ingestion.paymentMatch ?? null
      };
    }

    const matched = await this.workspaceReadRepository.matchStoredObservation({
      observationId: ingestion.observation.id,
      matchId: this.createId("mtc")
    });

    return {
      ...ingestion,
      observation: matched.observation,
      payment: matched.payment,
      paymentMatch: matched.match,
      match: matched.match
    };
  }

  private createMockBlockNumber() {
    return Math.floor(Date.now() / 1000);
  }

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(8).toString("hex")}`;
  }

  private async dispatchPostgresWebhookIfEnabled<T extends { id: string; status: string }>(
    result: { payment: T; changed: boolean }
  ) {
    if (!this.shouldWriteWebhooksToPostgres()) {
      return result.payment;
    }

    if (!result.changed) {
      return result.payment;
    }

    const payment = result.payment;
    if (payment.status === "finalized") {
      await this.webhooksService.dispatchPaymentFinalizedForPaymentId(payment.id);
      return payment;
    }

    if (payment.status === "failed") {
      await this.webhooksService.dispatchPaymentFailedForPaymentId(payment.id);
      return payment;
    }

    return payment;
  }

  private shouldWriteMatchingToPostgres() {
    return process.env.STABLEBOOKS_MATCHING_WRITE_MODE?.trim() === "postgres";
  }

  private shouldWriteTerminalPaymentsToPostgres() {
    return (
      process.env.STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE?.trim() === "postgres"
    );
  }

  private shouldWriteWebhooksToPostgres() {
    return process.env.STABLEBOOKS_WEBHOOK_WRITE_MODE?.trim() === "postgres";
  }

  private shouldReadFromPostgres() {
    return process.env.STABLEBOOKS_STORAGE_MODE?.trim() === "postgres_reads";
  }
}
