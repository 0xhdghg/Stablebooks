import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

type DatabaseIdentityRow = {
  databaseName: string;
  schemaName: string;
};

type MigrationSummaryRow = {
  migrationCount: number | bigint;
  lastAppliedAt: Date | null;
};

@Injectable()
export class PostgresReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async getStorageReadiness() {
    const storageMode = process.env.STABLEBOOKS_STORAGE_MODE?.trim() || "json";
    const arcEvidenceMirrorMode =
      process.env.STABLEBOOKS_ARC_EVIDENCE_MIRROR?.trim() || "disabled";
    const runtimeWriteModes = this.getRuntimeWriteModes();
    const postgresBackedRuntimeReady =
      storageMode === "postgres_reads" &&
      runtimeWriteModes.invoiceWriteMode === "postgres" &&
      runtimeWriteModes.paymentSessionWriteMode === "postgres" &&
      runtimeWriteModes.matchingWriteMode === "postgres" &&
      runtimeWriteModes.terminalPaymentWriteMode === "postgres" &&
      runtimeWriteModes.webhookWriteMode === "postgres";
    const databaseUrl = process.env.DATABASE_URL?.trim() || null;

    if (!databaseUrl) {
      return {
        storageMode,
        arcEvidenceMirrorMode,
        runtimeWriteModes,
        postgresBackedRuntimeReady,
        jsonStoreActive: storageMode === "json",
        postgres: {
          configured: false,
          reachable: false,
          databaseName: null,
          schemaName: null,
          migrationCount: 0,
          lastAppliedAt: null,
          latencyMs: null,
          error: "DATABASE_URL is not configured."
        }
      };
    }

    const startedAt = Date.now();

    try {
      const identity = await this.prisma.$queryRaw<DatabaseIdentityRow[]>`
        SELECT current_database() AS "databaseName", current_schema() AS "schemaName"
      `;
      const migrations = await this.prisma.$queryRaw<MigrationSummaryRow[]>`
        SELECT
          COUNT(*)::int AS "migrationCount",
          MAX("finished_at") AS "lastAppliedAt"
        FROM "_prisma_migrations"
        WHERE "finished_at" IS NOT NULL
      `;

      const databaseIdentity = identity[0] ?? {
        databaseName: null,
        schemaName: null
      };
      const migrationSummary = migrations[0] ?? {
        migrationCount: 0,
        lastAppliedAt: null
      };

      return {
        storageMode,
        arcEvidenceMirrorMode,
        runtimeWriteModes,
        postgresBackedRuntimeReady,
        jsonStoreActive: storageMode === "json",
        postgres: {
          configured: true,
          reachable: true,
          databaseName: databaseIdentity.databaseName,
          schemaName: databaseIdentity.schemaName,
          migrationCount: Number(migrationSummary.migrationCount),
          lastAppliedAt: migrationSummary.lastAppliedAt?.toISOString() ?? null,
          latencyMs: Date.now() - startedAt,
          error: null
        }
      };
    } catch (error) {
      return {
        storageMode,
        arcEvidenceMirrorMode,
        runtimeWriteModes,
        postgresBackedRuntimeReady,
        jsonStoreActive: storageMode === "json",
        postgres: {
          configured: true,
          reachable: false,
          databaseName: null,
          schemaName: null,
          migrationCount: 0,
          lastAppliedAt: null,
          latencyMs: Date.now() - startedAt,
          error: this.redactReadinessError(error)
        }
      };
    }
  }

  private getRuntimeWriteModes() {
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

  private redactReadinessError(error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown Postgres error.";
    const databaseUrl = process.env.DATABASE_URL?.trim();
    let redacted = message;

    if (databaseUrl) {
      redacted = redacted.split(databaseUrl).join("[redacted DATABASE_URL]");
    }

    return redacted.replace(
      /:\/\/[^:\s/]+:[^@\s/]+@/g,
      "://[redacted]@"
    );
  }
}
