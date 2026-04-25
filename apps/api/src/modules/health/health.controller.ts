import { Controller, Get } from "@nestjs/common";
import { PostgresReadinessService } from "../storage/postgres-readiness.service";
import { WorkspaceReadRepository } from "../storage/workspace-read.repository";

@Controller("health")
export class HealthController {
  constructor(
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
}
