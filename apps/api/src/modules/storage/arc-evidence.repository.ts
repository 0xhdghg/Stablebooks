import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";

export type ArcEvidenceIdentity = {
  chainId: number;
  txHash: string;
  logIndex: number;
};

export type ArcEvidenceFallbackIdentity = {
  chainId: number;
  txHash: string;
  toAddress: string;
  amountAtomic: string;
};

export type ArcEvidenceCreateInput = ArcEvidenceIdentity & {
  rawEventId?: string;
  observationId?: string;
  organizationId: string;
  walletId: string | null;
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
};

@Injectable()
export class ArcEvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      rawEventCount,
      observationCount,
      latestRawEvent,
      latestObservation
    ] = await this.prisma.$transaction([
      this.prisma.rawChainEvent.count(),
      this.prisma.chainPaymentObservation.count(),
      this.prisma.rawChainEvent.findFirst({
        orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          chainId: true,
          txHash: true,
          logIndex: true,
          sourceConfirmedAt: true,
          observedAt: true
        }
      }),
      this.prisma.chainPaymentObservation.findFirst({
        orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          rawChainEventId: true,
          status: true,
          sourceConfirmedAt: true,
          observedAt: true
        }
      })
    ]);

    return {
      rawEventCount,
      observationCount,
      latestRawEvent: latestRawEvent
        ? {
            ...latestRawEvent,
            sourceConfirmedAt:
              latestRawEvent.sourceConfirmedAt?.toISOString() ?? null,
            observedAt: latestRawEvent.observedAt.toISOString()
          }
        : null,
      latestObservation: latestObservation
        ? {
            ...latestObservation,
            sourceConfirmedAt:
              latestObservation.sourceConfirmedAt?.toISOString() ?? null,
            observedAt: latestObservation.observedAt.toISOString()
          }
        : null
    };
  }

  async findRawEventByPrimaryIdentity(input: ArcEvidenceIdentity) {
    return this.prisma.rawChainEvent.findUnique({
      where: {
        chainId_txHash_logIndex: {
          chainId: input.chainId,
          txHash: input.txHash,
          logIndex: input.logIndex
        }
      }
    });
  }

  async findRawEventByFallbackIdentity(input: ArcEvidenceFallbackIdentity) {
    return this.prisma.rawChainEvent.findFirst({
      where: {
        chainId: input.chainId,
        txHash: {
          equals: input.txHash,
          mode: "insensitive"
        },
        toAddress: {
          equals: input.toAddress,
          mode: "insensitive"
        },
        amountAtomic: input.amountAtomic
      }
    });
  }

  async createRawEventWithObservation(input: ArcEvidenceCreateInput) {
    const sourceConfirmedAt = this.toDate(input.sourceConfirmedAt);
    const observedAt = this.toDate(input.observedAt) ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const rawEvent = await tx.rawChainEvent.create({
        data: {
          id: input.rawEventId,
          organizationId: input.organizationId,
          walletId: input.walletId,
          chainId: input.chainId,
          txHash: input.txHash,
          logIndex: input.logIndex,
          blockNumber: input.blockNumber,
          blockTimestamp: this.toDate(input.blockTimestamp),
          fromAddress: input.fromAddress,
          toAddress: input.toAddress,
          token: input.token,
          amountAtomic: input.amountAtomic,
          decimals: input.decimals,
          sourceConfirmedAt,
          rawPayload: this.toJson(input.rawPayload),
          observedAt
        }
      });

      const observation = await tx.chainPaymentObservation.create({
        data: {
          id: input.observationId,
          organizationId: input.organizationId,
          walletId: input.walletId,
          rawChainEventId: rawEvent.id,
          chainId: input.chainId,
          txHash: input.txHash,
          logIndex: input.logIndex,
          blockNumber: input.blockNumber,
          fromAddress: input.fromAddress,
          toAddress: input.toAddress,
          token: input.token,
          amountAtomic: input.amountAtomic,
          decimals: input.decimals,
          status: "detected",
          observedAt,
          sourceConfirmedAt,
          rawPayload: this.toJson(input.rawPayload)
        }
      });

      return {
        rawEvent,
        observation
      };
    });
  }

  async mirrorRawEventWithObservation(input: ArcEvidenceCreateInput) {
    const existingRawEvent = await this.findRawEventByPrimaryIdentity(input);

    if (existingRawEvent) {
      const observation = await this.prisma.chainPaymentObservation.findFirst({
        where: { rawChainEventId: existingRawEvent.id }
      });

      return {
        mode: "deduped" as const,
        rawEvent: existingRawEvent,
        observation
      };
    }

    const created = await this.createRawEventWithObservation(input);

    return {
      mode: "created" as const,
      ...created
    };
  }

  private toDate(value: string | null) {
    return value ? new Date(value) : null;
  }

  private toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
