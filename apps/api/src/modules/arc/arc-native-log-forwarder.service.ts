import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ArcAdapterService } from "./arc-adapter.service";
import { ArcConfigService } from "./arc-config.service";
import { ArcRuntimeConfig } from "./arc.types";

type RpcLog = {
  address?: string;
  blockNumber?: string;
  data?: string;
  logIndex?: string;
  removed?: boolean;
  topics?: string[];
  transactionHash?: string;
};

type RpcBlock = {
  timestamp?: string;
};

const ARC_NATIVE_USDC_ADDRESS =
  "0x1800000000000000000000000000000000000000";
const ARC_NATIVE_USDC_TRANSFER_TOPIC =
  "0x62f084c00a442dcf51cdbb51beed2839bf42a268da8474b0e98f38edb7db5a22";
const MAX_BLOCK_RANGE = 500;

@Injectable()
export class ArcNativeLogForwarderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArcNativeLogForwarderService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private nextBlock: number | null = null;
  private readonly blockTimestampCache = new Map<number, string>();

  constructor(
    private readonly arcConfig: ArcConfigService,
    private readonly arcAdapter: ArcAdapterService
  ) {}

  onModuleInit() {
    const config = this.arcConfig.getRuntimeConfig();
    if (!this.shouldRun(config)) {
      return;
    }

    this.timer = setInterval(() => {
      void this.pollOnce().catch((error) => {
        this.logger.warn(`Arc native log polling failed: ${this.errorMessage(error)}`);
      });
    }, config.pollIntervalMs);

    void this.pollOnce().catch((error) => {
      this.logger.warn(`Initial Arc native log poll failed: ${this.errorMessage(error)}`);
    });
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async pollOnce() {
    if (this.polling) {
      return;
    }

    this.polling = true;
    try {
      const config = this.arcConfig.getRuntimeConfig();
      if (!this.shouldRun(config)) {
        return;
      }

      const latestBlock = await this.getLatestBlock(config);
      const finalizedBlock = latestBlock - config.confirmationsRequired;
      if (finalizedBlock <= 0) {
        return;
      }

      if (this.nextBlock === null) {
        this.nextBlock = config.startBlock ?? finalizedBlock + 1;
      }

      if (this.nextBlock > finalizedBlock) {
        return;
      }

      const fromBlock = this.nextBlock;
      const toBlock = Math.min(finalizedBlock, fromBlock + MAX_BLOCK_RANGE - 1);
      const logs = await this.getNativeTransferLogs(config, fromBlock, toBlock);

      for (const log of logs) {
        await this.ingestLog(config, log);
      }

      this.nextBlock = toBlock + 1;
    } finally {
      this.polling = false;
    }
  }

  private async ingestLog(config: ArcRuntimeConfig, log: RpcLog) {
    if (log.removed) {
      return;
    }

    const txHash = this.requireHexString(log.transactionHash, "transactionHash");
    const blockNumber = this.hexToNumber(log.blockNumber, "blockNumber");
    const logIndex = this.hexToNumber(log.logIndex, "logIndex");
    const topics = Array.isArray(log.topics) ? log.topics : [];
    const from = this.addressFromTopic(topics[1]);
    const to = this.addressFromTopic(topics[2]);
    const amount = this.uint256FromHex(log.data);
    const blockTimestamp = await this.getBlockTimestamp(config, blockNumber);

    if (!from || !to || !amount) {
      this.logger.warn(`Skipping undecodable Arc native log ${txHash}:${logIndex}.`);
      return;
    }

    const ingestion = await this.arcAdapter.ingestProviderEvent({
      txHash,
      blockNumber,
      confirmedAt: blockTimestamp,
      from,
      to,
      token: config.sourceProfile.tokenSymbol ?? "USDC",
      amount,
      decimals: config.sourceProfile.tokenDecimals ?? 18,
      chainId: config.chainId,
      logIndex,
      blockTimestamp,
      rawPayload: {
        provider: "arc_rpc_polling",
        address: log.address,
        topics,
        data: log.data
      }
    });

    if (!this.shouldFinalize(ingestion)) {
      return;
    }

    await this.arcAdapter.ingestProviderFinalityEvent({
      txHash,
      chainId: config.chainId,
      outcome: "finalized",
      logIndex,
      blockNumber,
      confirmedAt: blockTimestamp,
      settlementReference: `arc-rpc-${txHash.slice(2, 10)}-${logIndex}`
    });
  }

  private async getLatestBlock(config: ArcRuntimeConfig) {
    const result = await this.rpcRequest<string>(config, "eth_blockNumber", []);
    return this.hexToNumber(result, "latestBlock");
  }

  private async getNativeTransferLogs(
    config: ArcRuntimeConfig,
    fromBlock: number,
    toBlock: number
  ) {
    return this.rpcRequest<RpcLog[]>(config, "eth_getLogs", [
      {
        fromBlock: this.numberToHex(fromBlock),
        toBlock: this.numberToHex(toBlock),
        address: ARC_NATIVE_USDC_ADDRESS,
        topics: [ARC_NATIVE_USDC_TRANSFER_TOPIC]
      }
    ]);
  }

  private async getBlockTimestamp(config: ArcRuntimeConfig, blockNumber: number) {
    const cached = this.blockTimestampCache.get(blockNumber);
    if (cached) {
      return cached;
    }

    const block = await this.rpcRequest<RpcBlock | null>(
      config,
      "eth_getBlockByNumber",
      [this.numberToHex(blockNumber), false]
    );
    const timestamp = block?.timestamp
      ? new Date(this.hexToNumber(block.timestamp, "blockTimestamp") * 1000).toISOString()
      : new Date().toISOString();

    this.blockTimestampCache.set(blockNumber, timestamp);
    if (this.blockTimestampCache.size > 1000) {
      const firstKey = this.blockTimestampCache.keys().next().value;
      if (typeof firstKey === "number") {
        this.blockTimestampCache.delete(firstKey);
      }
    }

    return timestamp;
  }

  private async rpcRequest<T>(
    config: ArcRuntimeConfig,
    method: string,
    params: unknown[]
  ): Promise<T> {
    if (!config.rpcUrl) {
      throw new Error("ARC_RPC_URL is not configured.");
    }

    const response = await fetch(config.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params
      })
    });

    const payload = await response.json() as {
      result?: T;
      error?: { message?: string };
    };

    if (!response.ok || payload.error) {
      throw new Error(payload.error?.message ?? `RPC ${method} failed.`);
    }

    if (payload.result === undefined) {
      throw new Error(`RPC ${method} returned no result.`);
    }

    return payload.result;
  }

  private shouldRun(config: ArcRuntimeConfig) {
    return (
      config.enabled &&
      config.sourceKind === "rpc_polling" &&
      Boolean(config.rpcUrl) &&
      config.chainId !== null &&
      this.sourceProfileTargetsNativeArcUsdc(config)
    );
  }

  private sourceProfileTargetsNativeArcUsdc(config: ArcRuntimeConfig) {
    return (
      config.sourceProfile.contractAddress?.toLowerCase() ===
        ARC_NATIVE_USDC_ADDRESS &&
      config.sourceProfile.tokenSymbol === "USDC" &&
      config.sourceProfile.tokenDecimals === 18
    );
  }

  private shouldFinalize(ingestion: unknown) {
    if (!ingestion || typeof ingestion !== "object" || Array.isArray(ingestion)) {
      return false;
    }

    const payload = ingestion as {
      match?: { matchResult?: unknown };
      payment?: { status?: unknown };
    };

    return (
      payload.match?.matchResult === "exact" &&
      payload.payment?.status !== "finalized" &&
      payload.payment?.status !== "failed"
    );
  }

  private addressFromTopic(topic: string | undefined) {
    if (!topic) {
      return null;
    }

    const normalized = topic.trim().toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(normalized)) {
      return null;
    }

    return `0x${normalized.slice(-40)}`;
  }

  private uint256FromHex(value: string | undefined) {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    if (!/^0x[0-9a-f]+$/.test(normalized)) {
      return null;
    }

    return BigInt(normalized).toString(10);
  }

  private requireHexString(value: string | undefined, label: string) {
    if (!value || !/^0x[0-9a-fA-F]+$/.test(value)) {
      throw new Error(`Arc RPC log is missing ${label}.`);
    }

    return value.toLowerCase();
  }

  private hexToNumber(value: string | undefined, label: string) {
    if (!value || !/^0x[0-9a-fA-F]+$/.test(value)) {
      throw new Error(`Arc RPC value ${label} is not a hex integer.`);
    }

    const parsed = Number.parseInt(value, 16);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new Error(`Arc RPC value ${label} is outside safe integer range.`);
    }

    return parsed;
  }

  private numberToHex(value: number) {
    return `0x${value.toString(16)}`;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
