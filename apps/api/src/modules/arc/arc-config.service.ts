import { Injectable } from "@nestjs/common";
import { ArcRuntimeConfig, ArcSourceKind } from "./arc.types";

@Injectable()
export class ArcConfigService {
  getRuntimeConfig(): ArcRuntimeConfig {
    return {
      enabled: this.readBoolean("ARC_SOURCE_ENABLED", false),
      sourceKind: this.readSourceKind(),
      rpcUrl: this.readOptionalString("ARC_RPC_URL"),
      chainId: this.readOptionalInt("ARC_CHAIN_ID"),
      pollIntervalMs: this.readPositiveInt("ARC_POLL_INTERVAL_MS", 15000),
      confirmationsRequired: this.readNonNegativeInt(
        "ARC_CONFIRMATIONS_REQUIRED",
        1
      ),
      startBlock: this.readOptionalInt("ARC_START_BLOCK"),
      webhookSecret: this.readOptionalString("ARC_WEBHOOK_SECRET"),
      sourceProfile: {
        provider: "circle_event_monitor",
        eventMonitorSource: this.readOptionalString("ARC_EVENT_MONITOR_SOURCE"),
        contractAddress: this.readOptionalString("ARC_EVENT_CONTRACT_ADDRESS"),
        eventSignature: this.readOptionalString("ARC_EVENT_SIGNATURE"),
        tokenSymbol: this.readOptionalString("ARC_EVENT_TOKEN_SYMBOL")?.toUpperCase() ?? null,
        tokenDecimals: this.readOptionalInt("ARC_EVENT_TOKEN_DECIMALS")
      }
    };
  }

  getDevIngestKey() {
    return this.readOptionalString("ARC_DEV_INGEST_KEY") || "stablebooks-dev-arc-key";
  }

  private readSourceKind(): ArcSourceKind {
    const value = this.readOptionalString("ARC_SOURCE_KIND");
    if (
      value === "rpc_polling" ||
      value === "indexer_polling" ||
      value === "webhook" ||
      value === "fixtures"
    ) {
      return value;
    }

    return "rpc_polling";
  }

  private readOptionalString(name: string) {
    const value = process.env[name]?.trim();
    return value ? value : null;
  }

  private readBoolean(name: string, fallback: boolean) {
    const value = this.readOptionalString(name);
    if (!value) {
      return fallback;
    }

    return value === "1" || value.toLowerCase() === "true";
  }

  private readOptionalInt(name: string) {
    const value = this.readOptionalString(name);
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }

  private readPositiveInt(name: string, fallback: number) {
    const value = this.readOptionalInt(name);
    if (value === null || value <= 0) {
      return fallback;
    }

    return value;
  }

  private readNonNegativeInt(name: string, fallback: number) {
    const value = this.readOptionalInt(name);
    if (value === null || value < 0) {
      return fallback;
    }

    return value;
  }
}
