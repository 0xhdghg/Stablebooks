import { Injectable } from "@nestjs/common";
import { PaymentsService } from "../payments/payments.service";
import { ArcConfigService } from "./arc-config.service";
import { ArcFixturesService } from "./arc-fixtures.service";
import { ArcProviderDecoderService } from "./arc-provider-decoder.service";
import {
  ArcAdapterReadiness,
  ArcCanonicalEvent,
  ArcProviderBoundary,
  ArcProviderDiagnostic
} from "./arc.types";

@Injectable()
export class ArcAdapterService {
  constructor(
    private readonly arcConfig: ArcConfigService,
    private readonly arcFixtures: ArcFixturesService,
    private readonly arcProviderDecoder: ArcProviderDecoderService,
    private readonly paymentsService: PaymentsService
  ) {}

  getReadiness(): ArcAdapterReadiness {
    const config = this.arcConfig.getRuntimeConfig();
    const missing: string[] = [];

    if (config.enabled) {
      if (config.chainId === null) {
        missing.push("ARC_CHAIN_ID");
      }

      if (
        (config.sourceKind === "rpc_polling" ||
          config.sourceKind === "indexer_polling") &&
        !config.rpcUrl
      ) {
        missing.push("ARC_RPC_URL");
      }

      if (config.sourceKind === "webhook" && !config.webhookSecret) {
        missing.push("ARC_WEBHOOK_SECRET");
      }

      if (config.sourceKind === "webhook") {
        if (!config.sourceProfile.contractAddress) {
          missing.push("ARC_EVENT_CONTRACT_ADDRESS");
        }

        if (!config.sourceProfile.eventSignature) {
          missing.push("ARC_EVENT_SIGNATURE");
        }

        if (!config.sourceProfile.tokenSymbol) {
          missing.push("ARC_EVENT_TOKEN_SYMBOL");
        }

        if (config.sourceProfile.tokenDecimals === null) {
          missing.push("ARC_EVENT_TOKEN_DECIMALS");
        }
      }
    }

    return {
      ready: missing.length === 0,
      sourceKind: config.sourceKind,
      missing,
      config: {
        enabled: config.enabled,
        sourceKind: config.sourceKind,
        chainId: config.chainId,
        pollIntervalMs: config.pollIntervalMs,
        confirmationsRequired: config.confirmationsRequired,
        startBlock: config.startBlock,
        sourceProfile: config.sourceProfile,
        hasRpcUrl: Boolean(config.rpcUrl),
        hasWebhookSecret: Boolean(config.webhookSecret)
      }
    };
  }

  isEnabled() {
    return this.arcConfig.getRuntimeConfig().enabled;
  }

  listFixtureNames() {
    return this.arcFixtures.listFixtureNames();
  }

  async ingestProviderEvent(providerPayload: unknown) {
    const config = this.arcConfig.getRuntimeConfig();
    const decoded = this.arcProviderDecoder.decodeProviderEvent(providerPayload, {
      sourceKind: config.sourceKind,
      chainId: config.chainId,
      sourceProfile: config.sourceProfile
    });

    return this.ingestCanonicalEvent(decoded.canonicalEvent, decoded.boundary);
  }

  async ingestProviderFinalityEvent(providerPayload: unknown) {
    const config = this.arcConfig.getRuntimeConfig();
    const decoded = this.arcProviderDecoder.decodeFinalityEvent(providerPayload, {
      sourceKind: config.sourceKind,
      chainId: config.chainId,
      sourceProfile: config.sourceProfile
    });

    const payment =
      decoded.finalityEvent.outcome === "finalized"
        ? await this.paymentsService.confirmArcFinalityEvent(decoded.finalityEvent)
        : await this.paymentsService.failArcFinalityEvent(decoded.finalityEvent);

    return {
      sourceKind: this.arcConfig.getRuntimeConfig().sourceKind,
      providerBoundary: decoded.boundary,
      providerDiagnostic: this.toProviderDiagnostic(decoded.boundary),
      finalityEvent: decoded.finalityEvent,
      payment
    };
  }

  async ingestFixture(name: string, overrides: Partial<ArcCanonicalEvent> = {}) {
    const canonicalEvent = this.arcFixtures.createFixture(name, overrides);

    return this.ingestCanonicalEvent(canonicalEvent, {
      kind: "canonical",
      sourceKind: this.arcConfig.getRuntimeConfig().sourceKind,
      sourceProfileMatched: null,
      providerWarnings: [],
      warnings: []
    });
  }

  private async ingestCanonicalEvent(
    canonicalEvent: ArcCanonicalEvent,
    providerBoundary: ArcProviderBoundary
  ) {
    const providerDiagnostic = this.toProviderDiagnostic(providerBoundary);
    const ingestion = await this.paymentsService.ingestArcCanonicalEvent({
      ...canonicalEvent,
      rawPayload: {
        ...(canonicalEvent.rawPayload ?? {}),
        stablebooksProviderDiagnostic: providerDiagnostic
      }
    });

    return {
      sourceKind: this.arcConfig.getRuntimeConfig().sourceKind,
      providerBoundary,
      providerDiagnostic,
      canonicalEvent,
      ...ingestion
    };
  }

  private toProviderDiagnostic(
    providerBoundary: ArcProviderBoundary
  ): ArcProviderDiagnostic {
    return {
      boundaryKind: providerBoundary.kind,
      sourceKind: providerBoundary.sourceKind,
      sourceProfileMatched: providerBoundary.sourceProfileMatched,
      providerWarnings: providerBoundary.providerWarnings,
      rejectedReason: null
    };
  }
}
