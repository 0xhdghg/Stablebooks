import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

type RuntimeWriteModes = {
  invoiceWriteMode: string;
  paymentSessionWriteMode: string;
  matchingWriteMode: string;
  terminalPaymentWriteMode: string;
  webhookWriteMode: string;
};

export type HostedRuntimePolicy = {
  hostedDetected: boolean;
  platform: string | null;
  storageMode: string;
  runtimeWriteModes: RuntimeWriteModes;
  postgresBackedRuntimeReady: boolean;
  allowHostedJsonFallback: boolean;
  enforcementEnabled: boolean;
  policyOk: boolean;
  reasons: string[];
};

@Injectable()
export class HostedRuntimePolicyService implements OnModuleInit {
  private readonly logger = new Logger(HostedRuntimePolicyService.name);

  onModuleInit() {
    const policy = this.getPolicy();

    if (!policy.hostedDetected) {
      return;
    }

    if (policy.policyOk) {
      this.logger.log(
        `Hosted runtime policy ready on ${policy.platform ?? "unknown"} with storageMode=${policy.storageMode}.`
      );
      return;
    }

    const reasonText = policy.reasons.join(" ");
    const message =
      "Hosted runtime policy violation. " +
      reasonText +
      " Set STABLEBOOKS_ALLOW_HOSTED_JSON_FALLBACK=true only for an explicit, temporary hosted rollback.";

    if (policy.enforcementEnabled) {
      throw new Error(message);
    }

    this.logger.warn(message);
  }

  getPolicy(): HostedRuntimePolicy {
    const storageMode = process.env.STABLEBOOKS_STORAGE_MODE?.trim() || "json";
    const runtimeWriteModes = this.getRuntimeWriteModes();
    const postgresBackedRuntimeReady =
      storageMode === "postgres_reads" &&
      runtimeWriteModes.invoiceWriteMode === "postgres" &&
      runtimeWriteModes.paymentSessionWriteMode === "postgres" &&
      runtimeWriteModes.matchingWriteMode === "postgres" &&
      runtimeWriteModes.terminalPaymentWriteMode === "postgres" &&
      runtimeWriteModes.webhookWriteMode === "postgres";
    const platform = this.detectHostedPlatform();
    const hostedDetected = platform !== null;
    const allowHostedJsonFallback =
      process.env.STABLEBOOKS_ALLOW_HOSTED_JSON_FALLBACK?.trim() === "true";
    const enforcementEnabled =
      process.env.STABLEBOOKS_ENFORCE_HOSTED_RUNTIME_POLICY?.trim() !== "false";
    const reasons: string[] = [];

    if (hostedDetected && !postgresBackedRuntimeReady) {
      if (storageMode !== "postgres_reads") {
        reasons.push(
          `Hosted runtime uses storageMode=${storageMode} instead of postgres_reads.`
        );
      }

      for (const [key, value] of Object.entries(runtimeWriteModes)) {
        if (value !== "postgres") {
          reasons.push(`Hosted runtime uses ${key}=${value} instead of postgres.`);
        }
      }
    }

    const policyOk =
      !hostedDetected || postgresBackedRuntimeReady || allowHostedJsonFallback;

    return {
      hostedDetected,
      platform,
      storageMode,
      runtimeWriteModes,
      postgresBackedRuntimeReady,
      allowHostedJsonFallback,
      enforcementEnabled,
      policyOk,
      reasons
    };
  }

  private getRuntimeWriteModes(): RuntimeWriteModes {
    return {
      invoiceWriteMode:
        process.env.STABLEBOOKS_INVOICE_WRITE_MODE?.trim() || "json",
      paymentSessionWriteMode:
        process.env.STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE?.trim() || "json",
      matchingWriteMode:
        process.env.STABLEBOOKS_MATCHING_WRITE_MODE?.trim() || "json",
      terminalPaymentWriteMode:
        process.env.STABLEBOOKS_TERMINAL_PAYMENT_WRITE_MODE?.trim() || "json",
      webhookWriteMode:
        process.env.STABLEBOOKS_WEBHOOK_WRITE_MODE?.trim() || "json"
    };
  }

  private detectHostedPlatform() {
    if (process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT) {
      return "railway";
    }

    if (process.env.VERCEL) {
      return "vercel";
    }

    if (process.env.RENDER) {
      return "render";
    }

    if (process.env.FLY_APP_NAME) {
      return "fly";
    }

    return null;
  }
}
