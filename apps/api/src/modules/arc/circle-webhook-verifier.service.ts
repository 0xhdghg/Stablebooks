import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { createPublicKey, createVerify, KeyObject } from "node:crypto";

type CirclePublicKeyResponse = {
  data?: {
    id?: string;
    algorithm?: string;
    publicKey?: string;
  };
};

@Injectable()
export class CircleWebhookVerifierService {
  private readonly keyCache = new Map<string, KeyObject>();

  async verifyOrThrow(input: {
    keyId: string | undefined;
    signature: string | undefined;
    rawBody: Buffer | undefined;
  }) {
    if (!input.keyId || !input.signature || !input.rawBody) {
      throw new UnauthorizedException("Missing Circle webhook signature.");
    }

    const publicKey = await this.getPublicKey(input.keyId);
    const verifier = createVerify("SHA256");
    verifier.update(input.rawBody);
    verifier.end();

    const valid = verifier.verify(publicKey, Buffer.from(input.signature, "base64"));
    if (!valid) {
      throw new UnauthorizedException("Invalid Circle webhook signature.");
    }
  }

  private async getPublicKey(keyId: string) {
    const cached = this.keyCache.get(keyId);
    if (cached) {
      return cached;
    }

    const configured = this.readConfiguredPublicKey(keyId);
    const key = configured ?? (await this.fetchCirclePublicKey(keyId));

    this.keyCache.set(keyId, key);
    return key;
  }

  private readConfiguredPublicKey(keyId: string) {
    const raw = process.env.CIRCLE_WEBHOOK_PUBLIC_KEYS_JSON?.trim();
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      const value = parsed[keyId];
      return value ? this.createKey(value) : null;
    } catch {
      throw new ServiceUnavailableException(
        "Circle webhook public key configuration is invalid."
      );
    }
  }

  private async fetchCirclePublicKey(keyId: string) {
    const apiKey = process.env.CIRCLE_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "Circle API key is not configured for webhook verification."
      );
    }

    const baseUrl =
      process.env.CIRCLE_PUBLIC_KEY_BASE_URL?.trim() ||
      "https://api.circle.com/v2/notifications/publicKey";
    const response = await fetch(`${baseUrl}/${encodeURIComponent(keyId)}`, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new UnauthorizedException("Circle webhook public key lookup failed.");
    }

    const payload = (await response.json()) as CirclePublicKeyResponse;
    const publicKey = payload.data?.publicKey;
    if (!publicKey) {
      throw new UnauthorizedException("Circle webhook public key is unavailable.");
    }

    return this.createKey(publicKey);
  }

  private createKey(value: string) {
    const trimmed = value.trim();
    if (trimmed.startsWith("-----BEGIN")) {
      return createPublicKey(trimmed);
    }

    return createPublicKey({
      key: Buffer.from(trimmed, "base64"),
      format: "der",
      type: "spki"
    });
  }
}
