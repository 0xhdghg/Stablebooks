import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PaymentMatchingService } from "./payment-matching.service";
import {
  AppChainPaymentObservation,
  AppPaymentMatch,
  AppRawChainEvent,
  AppStore,
  StorageService
} from "../storage/storage.service";
import { ArcEvidenceRepository } from "../storage/arc-evidence.repository";

type RawChainInput = {
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
};

@Injectable()
export class RawChainIngestionService {
  constructor(
    private readonly storage: StorageService,
    private readonly paymentMatchingService: PaymentMatchingService,
    private readonly arcEvidenceRepository: ArcEvidenceRepository
  ) {}

  async ingestRawEvent(input: RawChainInput) {
    const normalized = this.normalizeInput(input);

    const ingestion = await this.storage.mutate(async (store) => {
      const dedupeMatch = this.findExistingRawEvent(store, normalized);

      if (dedupeMatch) {
        return {
          deduped: true,
          dedupeMode: dedupeMatch.mode,
          rawEvent: dedupeMatch.event,
          observation:
            store.chainPaymentObservations.find(
              (entry) => entry.rawChainEventId === dedupeMatch.event.id
            ) ?? null,
          paymentMatch:
            store.paymentMatches.find((entry) => {
              const observation = store.chainPaymentObservations.find(
                (item) => item.id === entry.observationId
              );
              return observation?.rawChainEventId === dedupeMatch.event.id;
            }) ?? null
        };
      }

      const routing = this.paymentMatchingService.resolveObservationMatch(
        store,
        {
          chainId: normalized.chainId,
          toAddress: normalized.toAddress,
          token: normalized.token,
          amountAtomic: normalized.amountAtomic,
          decimals: normalized.decimals
        },
        {}
      );

      if (!routing.wallet || !routing.organizationId) {
        throw new NotFoundException(
          "No known settlement wallet could be resolved for this raw chain event."
        );
      }

      const now = new Date().toISOString();
      const rawEvent: AppRawChainEvent = {
        id: this.createId("rce"),
        organizationId: routing.organizationId,
        walletId: routing.wallet.id,
        chainId: normalized.chainId,
        txHash: normalized.txHash,
        logIndex: normalized.logIndex,
        blockNumber: normalized.blockNumber,
        blockTimestamp: normalized.blockTimestamp,
        fromAddress: normalized.fromAddress,
        toAddress: normalized.toAddress,
        token: normalized.token,
        amountAtomic: normalized.amountAtomic,
        decimals: normalized.decimals,
        sourceConfirmedAt: normalized.confirmedAt,
        rawPayload: normalized.rawPayload,
        observedAt: now,
        createdAt: now,
        updatedAt: now
      };
      store.rawChainEvents.push(rawEvent);

      const observation: AppChainPaymentObservation = {
        id: this.createId("obs"),
        organizationId: routing.organizationId,
        walletId: routing.wallet.id,
        paymentId: null,
        invoiceId: null,
        rawChainEventId: rawEvent.id,
        chainId: normalized.chainId,
        txHash: normalized.txHash,
        logIndex: normalized.logIndex,
        blockNumber: normalized.blockNumber,
        fromAddress: normalized.fromAddress,
        toAddress: normalized.toAddress,
        token: normalized.token,
        amountAtomic: normalized.amountAtomic,
        decimals: normalized.decimals,
        status: "detected",
        observedAt: now,
        sourceConfirmedAt: normalized.confirmedAt,
        confirmedAt: null,
        rawPayload: normalized.rawPayload,
        createdAt: now,
        updatedAt: now
      };
      store.chainPaymentObservations.push(observation);

      const paymentMatch: AppPaymentMatch = {
        id: this.createId("mtc"),
        organizationId: routing.organizationId,
        paymentId: null,
        invoiceId: null,
        observationId: observation.id,
        matchResult: routing.matchResult,
        matchReason:
          routing.matchResult === "exact"
            ? "Raw chain event was normalized successfully; exact matching is deferred to the matching step."
            : routing.matchReason,
        createdAt: now,
        updatedAt: now
      };
      store.paymentMatches.push(paymentMatch);

      return {
        deduped: false,
        dedupeMode: "none",
        rawEvent,
        observation,
        paymentMatch
      };
    });

    const postgresMirror = await this.mirrorEvidenceToPostgres(ingestion);

    return {
      ...ingestion,
      postgresMirror
    };
  }

  private normalizeInput(input: RawChainInput) {
    const txHash = input.txHash?.trim() || this.createMockTxHash();
    const fromAddress = input.from.trim();
    const toAddress = input.to.trim();
    const token = input.token.trim().toUpperCase();
    const amountAtomic = String(input.amount ?? "").trim();
    const decimals = Number(input.decimals);
    const chainId = Number(input.chainId);
    const blockNumber = Number(input.blockNumber);
    const confirmedAt = input.confirmedAt?.trim() || null;
    const logIndex =
      input.logIndex === undefined || input.logIndex === null
        ? 0
        : Number(input.logIndex);

    if (!fromAddress || !toAddress || !token || !amountAtomic) {
      throw new BadRequestException("from, to, token, and amount are required.");
    }

    if (!Number.isFinite(blockNumber) || blockNumber <= 0 || !Number.isInteger(blockNumber)) {
      throw new BadRequestException("blockNumber must be a positive integer.");
    }

    if (!Number.isFinite(logIndex) || logIndex < 0 || !Number.isInteger(logIndex)) {
      throw new BadRequestException("logIndex must be a non-negative integer.");
    }

    if (!Number.isFinite(decimals) || decimals < 0 || !Number.isInteger(decimals)) {
      throw new BadRequestException("decimals must be a non-negative integer.");
    }

    if (!Number.isFinite(chainId) || chainId <= 0 || !Number.isInteger(chainId)) {
      throw new BadRequestException("chainId must be a positive integer.");
    }

    if (!/^\d+$/.test(amountAtomic)) {
      throw new BadRequestException("amount must be a base-10 integer string.");
    }

    if (confirmedAt && Number.isNaN(Date.parse(confirmedAt))) {
      throw new BadRequestException("confirmedAt must be a valid ISO timestamp.");
    }

    return {
      txHash,
      logIndex,
      blockNumber,
      blockTimestamp: input.blockTimestamp?.trim() || null,
      confirmedAt: confirmedAt ? new Date(confirmedAt).toISOString() : null,
      fromAddress,
      toAddress,
      token,
      amountAtomic,
      decimals,
      chainId,
      rawPayload: input.rawPayload ?? {}
    };
  }

  private findExistingRawEvent(
    store: AppStore,
    input: {
      chainId: number;
      txHash: string;
      logIndex: number;
      toAddress: string;
      amountAtomic: string;
    }
  ) {
    const primaryMatch =
      store.rawChainEvents.find(
        (event) =>
          event.chainId === input.chainId &&
          event.txHash.toLowerCase() === input.txHash.toLowerCase() &&
          event.logIndex === input.logIndex
      ) ?? null;

    if (primaryMatch) {
      return {
        mode: "primary",
        event: primaryMatch
      } as const;
    }

    const fallbackMatch =
      store.rawChainEvents.find(
        (event) =>
          event.chainId === input.chainId &&
          event.txHash.toLowerCase() === input.txHash.toLowerCase() &&
          event.toAddress.toLowerCase() === input.toAddress.toLowerCase() &&
          event.amountAtomic === input.amountAtomic
      ) ?? null;

    if (!fallbackMatch) {
      return null;
    }

    return {
      mode: "fallback",
      event: fallbackMatch
    } as const;
  }

  private createMockTxHash() {
    return `0x${randomBytes(32).toString("hex")}`;
  }

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(8).toString("hex")}`;
  }

  private async mirrorEvidenceToPostgres(input: {
    rawEvent: AppRawChainEvent;
    observation: AppChainPaymentObservation | null;
  }) {
    const mode = this.getArcEvidenceMirrorMode();

    if (mode === "disabled") {
      return {
        enabled: false,
        mode
      };
    }

    if (!input.observation) {
      return {
        enabled: true,
        mode,
        status: "skipped",
        reason: "No normalized observation is available to mirror."
      };
    }

    if (!input.rawEvent.organizationId) {
      return {
        enabled: true,
        mode,
        status: "skipped",
        reason: "Raw event is not associated with an organization."
      };
    }

    try {
      const result =
        await this.arcEvidenceRepository.mirrorRawEventWithObservation({
          rawEventId: input.rawEvent.id,
          observationId: input.observation.id,
          organizationId: input.rawEvent.organizationId,
          walletId: input.rawEvent.walletId,
          chainId: input.rawEvent.chainId,
          txHash: input.rawEvent.txHash,
          logIndex: input.rawEvent.logIndex,
          blockNumber: input.rawEvent.blockNumber,
          blockTimestamp: input.rawEvent.blockTimestamp,
          fromAddress: input.rawEvent.fromAddress,
          toAddress: input.rawEvent.toAddress,
          token: input.rawEvent.token,
          amountAtomic: input.rawEvent.amountAtomic,
          decimals: input.rawEvent.decimals,
          sourceConfirmedAt: input.rawEvent.sourceConfirmedAt,
          rawPayload: input.rawEvent.rawPayload,
          observedAt: input.rawEvent.observedAt
        });

      return {
        enabled: true,
        mode,
        status: result.mode,
        rawEventId: result.rawEvent.id,
        observationId: result.observation?.id ?? null
      };
    } catch (error) {
      if (mode === "postgres_strict") {
        throw error;
      }

      return {
        enabled: true,
        mode,
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Unknown Postgres evidence mirror error."
      };
    }
  }

  private getArcEvidenceMirrorMode() {
    const rawMode = process.env.STABLEBOOKS_ARC_EVIDENCE_MIRROR?.trim();

    if (rawMode === "postgres_shadow" || rawMode === "postgres_strict") {
      return rawMode;
    }

    return "disabled";
  }
}
