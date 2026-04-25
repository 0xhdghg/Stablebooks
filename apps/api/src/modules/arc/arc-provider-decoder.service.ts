import { BadRequestException, Injectable } from "@nestjs/common";
import { ArcEventNormalizerService } from "./arc-event-normalizer.service";
import {
  ArcDecodedFinalityEvent,
  ArcDecodedProviderEvent,
  ArcProviderBoundary,
  ArcProviderSourceProfile,
  ArcSourceKind
} from "./arc.types";

type DecoderContext = {
  sourceKind: ArcSourceKind;
  chainId: number | null;
  sourceProfile: ArcProviderSourceProfile;
};

@Injectable()
export class ArcProviderDecoderService {
  constructor(private readonly normalizer: ArcEventNormalizerService) {}

  decodeProviderEvent(
    providerPayload: unknown,
    context: DecoderContext
  ): ArcDecodedProviderEvent {
    const circleNotification = this.readCircleEventMonitorNotification(providerPayload);

    if (circleNotification) {
      const decoded = this.readDecodedTransferArgs(providerPayload, circleNotification);

      if (!decoded) {
        this.throwProviderRejection(
          "missing_decoded_transfer_args",
          "Circle event monitor payload requires decoded Transfer args before canonical ingestion.",
          context
        );
      }

      this.assertCircleEventMonitorProfile(circleNotification, decoded, context);

      return {
        boundary: this.createBoundary("circle_event_monitor", context.sourceKind, {
          sourceProfileMatched: true
        }),
        canonicalEvent: this.normalizer.normalizeProviderEvent(
          this.toCanonicalCircleEventMonitorPayload(
            providerPayload,
            circleNotification,
            decoded
          )
        )
      };
    }

    return {
      boundary: this.createBoundary("canonical", context.sourceKind, {
        sourceProfileMatched: null
      }),
      canonicalEvent: this.normalizer.normalizeProviderEvent(providerPayload)
    };
  }

  decodeFinalityEvent(
    providerPayload: unknown,
    context: DecoderContext
  ): ArcDecodedFinalityEvent {
    return {
      boundary: this.createBoundary("canonical", context.sourceKind, {
        sourceProfileMatched: null
      }),
      finalityEvent: this.normalizer.normalizeFinalityEvent(providerPayload)
    };
  }

  private toCanonicalCircleEventMonitorPayload(
    providerPayload: unknown,
    notification: Record<string, unknown>,
    decoded: Record<string, unknown>
  ) {
    return {
      txHash: this.readFirstValue(notification, [
        "txHash",
        "transactionHash",
        "hash"
      ]),
      blockNumber: this.readFirstValue(notification, [
        "blockNumber",
        "block_height",
        "blockHeight"
      ]),
      confirmedAt: this.readFirstValue(notification, [
        "confirmedAt",
        "confirmed_at",
        "firstConfirmDate",
        "finalizedAt",
        "finalized_at"
      ]),
      from: this.readFirstValue(decoded, ["from", "fromAddress", "sender"]),
      to: this.readFirstValue(decoded, ["to", "toAddress", "recipient"]),
      token:
        this.readFirstValue(decoded, ["token", "tokenSymbol", "asset", "symbol"]) ??
        this.readFirstValue(notification, [
          "token",
          "tokenSymbol",
          "asset",
          "symbol"
        ]),
      amount: this.readFirstValue(decoded, ["amount", "amountAtomic", "value"]),
      decimals:
        this.readFirstValue(decoded, [
          "decimals",
          "tokenDecimals",
          "assetDecimals"
        ]) ??
        this.readFirstValue(notification, [
          "decimals",
          "tokenDecimals",
          "assetDecimals"
        ]),
      chainId:
        this.readFirstValue(decoded, ["chainId", "networkId"]) ??
        this.readFirstValue(notification, ["chainId", "networkId"]) ??
        this.readArcChainIdFromBlockchain(notification),
      logIndex: this.readFirstValue(notification, [
        "logIndex",
        "log_index",
        "eventIndex"
      ]),
      blockTimestamp: this.readFirstValue(notification, [
        "blockTimestamp",
        "block_timestamp",
        "timestamp",
        "firstConfirmDate"
      ]),
      provider: "circle_event_monitor",
      rawPayload: this.asRecord(providerPayload)
    };
  }

  private assertCircleEventMonitorProfile(
    notification: Record<string, unknown>,
    decoded: Record<string, unknown>,
    context: DecoderContext
  ) {
    const profile = context.sourceProfile;
    const chainId = this.readInteger(
      this.readFirstValue(decoded, ["chainId", "networkId"]) ??
        this.readFirstValue(notification, ["chainId", "networkId"]) ??
        this.readArcChainIdFromBlockchain(notification)
    );

    if (context.chainId !== null && chainId !== context.chainId) {
      this.throwProviderRejection(
        "chain_id_mismatch",
        "Arc provider payload rejected: chainId does not match configured ARC_CHAIN_ID.",
        context
      );
    }

    if (profile.contractAddress) {
      const contractAddress = this.readString(
        this.readFirstValue(notification, ["contractAddress", "contract_address"])
      );

      if (
        !contractAddress ||
        contractAddress.toLowerCase() !== profile.contractAddress.toLowerCase()
      ) {
        this.throwProviderRejection(
          "contract_address_mismatch",
          "Arc provider payload rejected: contractAddress does not match configured ARC_EVENT_CONTRACT_ADDRESS.",
          context
        );
      }
    }

    if (profile.eventSignature) {
      const eventSignature = this.readString(
        this.readFirstValue(notification, [
          "eventSignature",
          "event_signature",
          "signature",
          "eventName"
        ])
      );

      if (
        !eventSignature ||
        !this.eventSignatureMatches(eventSignature, profile.eventSignature)
      ) {
        this.throwProviderRejection(
          "event_signature_mismatch",
          "Arc provider payload rejected: event signature does not match configured ARC_EVENT_SIGNATURE.",
          context
        );
      }
    }

    if (profile.tokenSymbol) {
      const token = this.readString(
        this.readFirstValue(decoded, ["token", "tokenSymbol", "asset", "symbol"]) ??
          this.readFirstValue(notification, [
            "token",
            "tokenSymbol",
            "asset",
            "symbol"
          ])
      );

      if (!token || token.toUpperCase() !== profile.tokenSymbol) {
        this.throwProviderRejection(
          "token_symbol_mismatch",
          "Arc provider payload rejected: token does not match configured ARC_EVENT_TOKEN_SYMBOL.",
          context
        );
      }
    }

    if (profile.tokenDecimals !== null) {
      const decimals = this.readInteger(
        this.readFirstValue(decoded, [
          "decimals",
          "tokenDecimals",
          "assetDecimals"
        ]) ??
          this.readFirstValue(notification, [
            "decimals",
            "tokenDecimals",
            "assetDecimals"
          ])
      );

      if (decimals !== profile.tokenDecimals) {
        this.throwProviderRejection(
          "token_decimals_mismatch",
          "Arc provider payload rejected: decimals do not match configured ARC_EVENT_TOKEN_DECIMALS.",
          context
        );
      }
    }
  }

  private readCircleEventMonitorNotification(providerPayload: unknown) {
    const payload = this.asRecord(providerPayload);
    if (!payload) {
      return null;
    }

    const nestedNotification = this.asRecord(payload.notification);
    if (nestedNotification && this.looksLikeCircleEventMonitor(nestedNotification)) {
      return nestedNotification;
    }

    if (this.looksLikeCircleEventMonitor(payload)) {
      return payload;
    }

    return null;
  }

  private looksLikeCircleEventMonitor(payload: Record<string, unknown>) {
    return Boolean(
      this.readFirstValue(payload, ["blockchain", "contractAddress", "topics", "data"]) &&
        this.readFirstValue(payload, ["txHash", "transactionHash", "hash"])
    );
  }

  private readDecodedTransferArgs(
    providerPayload: unknown,
    notification: Record<string, unknown>
  ) {
    const payload = this.asRecord(providerPayload);

    return (
      this.asRecord(notification.decoded) ??
      this.asRecord(notification.args) ??
      this.asRecord(notification.event) ??
      this.asRecord(payload?.decoded) ??
      this.asRecord(payload?.args) ??
      this.asRecord(payload?.event) ??
      null
    );
  }

  private readArcChainIdFromBlockchain(notification: Record<string, unknown>) {
    const blockchain = this.readFirstValue(notification, ["blockchain"]);

    if (typeof blockchain !== "string") {
      return undefined;
    }

    return blockchain.toLowerCase().includes("arc") ? 5042002 : undefined;
  }

  private createBoundary(
    kind: ArcProviderBoundary["kind"],
    sourceKind: ArcSourceKind,
    input: {
      sourceProfileMatched: boolean | null;
      providerWarnings?: string[];
    }
  ): ArcProviderBoundary {
    const providerWarnings = input.providerWarnings ?? [];

    return {
      kind,
      sourceKind,
      sourceProfileMatched: input.sourceProfileMatched,
      providerWarnings,
      warnings: providerWarnings
    };
  }

  private throwProviderRejection(
    rejectedReason: string,
    message: string,
    context: DecoderContext
  ): never {
    throw new BadRequestException({
      message,
      rejectedReason,
      providerDiagnostic: {
        boundaryKind: "circle_event_monitor",
        sourceKind: context.sourceKind,
        sourceProfileMatched: false,
        providerWarnings: [],
        rejectedReason
      }
    });
  }

  private readFirstValue(payload: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      if (key in payload) {
        return payload[key];
      }
    }

    return undefined;
  }

  private readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private readInteger(value: unknown) {
    if (typeof value === "number" && Number.isInteger(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.trim());
      return Number.isInteger(parsed) ? parsed : null;
    }

    return null;
  }

  private eventSignatureMatches(actual: string, expected: string) {
    const normalizedActual = actual.trim().toLowerCase();
    const normalizedExpected = expected.trim().toLowerCase();

    return (
      normalizedActual === normalizedExpected ||
      normalizedActual === normalizedExpected.split("(")[0]
    );
  }

  private asRecord(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }
}
