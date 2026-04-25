import { BadRequestException, Injectable } from "@nestjs/common";
import { ArcCanonicalEvent, ArcFinalityEvent, ArcFinalityOutcome } from "./arc.types";

@Injectable()
export class ArcEventNormalizerService {
  normalizeProviderEvent(providerPayload: unknown): ArcCanonicalEvent {
    if (!providerPayload || typeof providerPayload !== "object" || Array.isArray(providerPayload)) {
      throw new BadRequestException("Arc provider payload must be an object.");
    }

    const payload = providerPayload as Record<string, unknown>;

    const txHash = this.requireString(payload, ["txHash", "transactionHash", "hash"]);
    const blockNumber = this.requirePositiveInteger(payload, [
      "blockNumber",
      "block_height",
      "blockHeight"
    ]);
    const confirmedAt = this.requireIsoTimestamp(payload, [
      "confirmedAt",
      "confirmed_at",
      "finalizedAt",
      "finalized_at"
    ]);
    const from = this.requireString(payload, ["from", "fromAddress", "sender"]);
    const to = this.requireString(payload, ["to", "toAddress", "recipient"]);
    const token = this.requireString(payload, ["token", "tokenSymbol", "asset", "symbol"]);
    const amount = this.requireAtomicAmount(payload, ["amount", "amountAtomic", "value"]);
    const decimals = this.requireNonNegativeInteger(payload, [
      "decimals",
      "tokenDecimals",
      "assetDecimals"
    ]);
    const chainId = this.requirePositiveInteger(payload, ["chainId", "networkId"]);
    const logIndex = this.readOptionalNonNegativeInteger(payload, [
      "logIndex",
      "log_index",
      "eventIndex"
    ]);
    const blockTimestamp = this.readOptionalIsoTimestamp(payload, [
      "blockTimestamp",
      "block_timestamp",
      "timestamp"
    ]);

    return {
      txHash,
      blockNumber,
      confirmedAt,
      from,
      to,
      token: token.toUpperCase(),
      amount,
      decimals,
      chainId,
      ...(logIndex === null ? {} : { logIndex }),
      ...(blockTimestamp === null ? {} : { blockTimestamp }),
      rawPayload: payload
    };
  }

  normalizeFinalityEvent(providerPayload: unknown): ArcFinalityEvent {
    if (!providerPayload || typeof providerPayload !== "object" || Array.isArray(providerPayload)) {
      throw new BadRequestException("Arc finality payload must be an object.");
    }

    const payload = providerPayload as Record<string, unknown>;
    const txHash = this.requireString(payload, ["txHash", "transactionHash", "hash"]);
    const chainId = this.requirePositiveInteger(payload, ["chainId", "networkId"]);
    const outcome = this.requireFinalityOutcome(payload, ["outcome", "status", "result"]);
    const logIndex = this.readOptionalNonNegativeInteger(payload, [
      "logIndex",
      "log_index",
      "eventIndex"
    ]);
    const blockNumber = this.readOptionalPositiveInteger(payload, [
      "blockNumber",
      "block_height",
      "blockHeight"
    ]);
    const confirmedAt = this.readOptionalIsoTimestamp(payload, [
      "confirmedAt",
      "confirmed_at",
      "finalizedAt",
      "finalized_at"
    ]);
    const failureReason = this.readOptionalTrimmedString(payload, [
      "failureReason",
      "rejectionReason",
      "error",
      "message"
    ]);
    const settlementReference = this.readOptionalTrimmedString(payload, [
      "settlementReference",
      "settlement_reference"
    ]);

    return {
      txHash,
      chainId,
      outcome,
      ...(logIndex === null ? {} : { logIndex }),
      ...(blockNumber === null ? {} : { blockNumber }),
      ...(confirmedAt === null ? {} : { confirmedAt }),
      ...(failureReason === null ? {} : { failureReason }),
      ...(settlementReference === null ? {} : { settlementReference }),
      rawPayload: payload
    };
  }

  private requireString(payload: Record<string, unknown>, keys: string[]) {
    const value = this.readFirstValue(payload, keys);
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`Arc event is missing required field: ${keys[0]}.`);
    }

    return value.trim();
  }

  private requirePositiveInteger(payload: Record<string, unknown>, keys: string[]) {
    const value = this.readInteger(payload, keys);
    if (value === null || value <= 0) {
      throw new BadRequestException(`Arc event field ${keys[0]} must be a positive integer.`);
    }

    return value;
  }

  private requireNonNegativeInteger(payload: Record<string, unknown>, keys: string[]) {
    const value = this.readInteger(payload, keys);
    if (value === null || value < 0) {
      throw new BadRequestException(
        `Arc event field ${keys[0]} must be a non-negative integer.`
      );
    }

    return value;
  }

  private readOptionalPositiveInteger(payload: Record<string, unknown>, keys: string[]) {
    const value = this.readInteger(payload, keys);
    if (value === null) {
      return null;
    }

    if (value <= 0) {
      throw new BadRequestException(`Arc event field ${keys[0]} must be a positive integer.`);
    }

    return value;
  }

  private readOptionalNonNegativeInteger(
    payload: Record<string, unknown>,
    keys: string[]
  ) {
    const value = this.readInteger(payload, keys);
    if (value === null) {
      return null;
    }

    if (value < 0) {
      throw new BadRequestException(
        `Arc event field ${keys[0]} must be a non-negative integer.`
      );
    }

    return value;
  }

  private requireIsoTimestamp(payload: Record<string, unknown>, keys: string[]) {
    const value = this.requireString(payload, keys);
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(`Arc event field ${keys[0]} must be a valid ISO timestamp.`);
    }

    return new Date(parsed).toISOString();
  }

  private readOptionalIsoTimestamp(payload: Record<string, unknown>, keys: string[]) {
    const value = this.readFirstValue(payload, keys);
    if (value === undefined || value === null || value === "") {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException(`Arc event field ${keys[0]} must be a valid ISO timestamp.`);
    }

    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(`Arc event field ${keys[0]} must be a valid ISO timestamp.`);
    }

    return new Date(parsed).toISOString();
  }

  private requireAtomicAmount(payload: Record<string, unknown>, keys: string[]) {
    const value = this.readFirstValue(payload, keys);
    const amount =
      typeof value === "number" || typeof value === "bigint"
        ? String(value)
        : typeof value === "string"
          ? value.trim()
          : null;

    if (!amount || !/^\d+$/.test(amount)) {
      throw new BadRequestException(
        `Arc event field ${keys[0]} must be a base-10 integer string.`
      );
    }

    return amount;
  }

  private requireFinalityOutcome(payload: Record<string, unknown>, keys: string[]) {
    const value = this.requireString(payload, keys).toLowerCase();
    const normalized = this.normalizeFinalityOutcome(value);

    if (!normalized) {
      throw new BadRequestException(
        `Arc finality field ${keys[0]} must resolve to finalized or failed.`
      );
    }

    return normalized;
  }

  private normalizeFinalityOutcome(value: string): ArcFinalityOutcome | null {
    if (
      value === "finalized" ||
      value === "confirmed" ||
      value === "success" ||
      value === "succeeded"
    ) {
      return "finalized";
    }

    if (
      value === "failed" ||
      value === "failure" ||
      value === "rejected" ||
      value === "error"
    ) {
      return "failed";
    }

    return null;
  }

  private readOptionalTrimmedString(payload: Record<string, unknown>, keys: string[]) {
    const value = this.readFirstValue(payload, keys);
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException(`Arc event field ${keys[0]} must be a string.`);
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private readInteger(payload: Record<string, unknown>, keys: string[]) {
    const value = this.readFirstValue(payload, keys);
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.trim())
          : NaN;

    return Number.isInteger(parsed) ? parsed : null;
  }

  private readFirstValue(payload: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      if (key in payload) {
        return payload[key];
      }
    }

    return undefined;
  }
}
