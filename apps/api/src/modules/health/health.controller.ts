import { Controller, Get } from "@nestjs/common";
import { ArcAdapterService } from "../arc/arc-adapter.service";
import { PostgresReadinessService } from "../storage/postgres-readiness.service";
import { WorkspaceReadRepository } from "../storage/workspace-read.repository";

@Controller("health")
export class HealthController {
  constructor(
    private readonly arcAdapter: ArcAdapterService,
    private readonly postgresReadiness: PostgresReadinessService,
    private readonly workspaceReadRepository: WorkspaceReadRepository
  ) {}

  @Get("live")
  live() {
    return {
      status: "ok",
      service: "stablebooks-api"
    };
  }

  @Get("storage")
  async storage() {
    const readiness = await this.postgresReadiness.getStorageReadiness();
    const healthy =
      readiness.postgres.reachable && readiness.hostedRuntimePolicy.policyOk;

    return {
      status: healthy ? "ok" : "degraded",
      service: "stablebooks-api",
      data: readiness
    };
  }

  @Get("runtime")
  async runtime() {
    const storage = await this.postgresReadiness.getStorageReadiness();
    const arc = this.arcAdapter.getReadiness();
    const outboundWebhook = this.getOutboundWebhookSummary();
    const healthy =
      storage.postgres.reachable &&
      storage.hostedRuntimePolicy.policyOk &&
      arc.ready;

    return {
      status: healthy ? "ok" : "degraded",
      service: "stablebooks-api",
      data: {
        storage,
        arc,
        outboundWebhook
      }
    };
  }

  @Get("postgres-workspace")
  async postgresWorkspace() {
    return {
      status: "ok",
      service: "stablebooks-api",
      data: {
        backend: "postgres",
        summary: await this.workspaceReadRepository.getSummary()
      }
    };
  }

  private getOutboundWebhookSummary() {
    const destination = process.env.STABLEBOOKS_WEBHOOK_URL?.trim() || null;
    let destinationHost: string | null = null;

    if (destination) {
      try {
        destinationHost = new URL(destination).host;
      } catch {
        destinationHost = "[invalid webhook url]";
      }
    }

    return {
      configured: Boolean(destination),
      mode: destination ? "configured" : "disabled",
      destinationHost,
      signingSecretConfigured: Boolean(
        process.env.STABLEBOOKS_WEBHOOK_SECRET?.trim()
      ),
      maxAttempts: Number(process.env.STABLEBOOKS_WEBHOOK_MAX_ATTEMPTS ?? 4)
    };
  }
}
