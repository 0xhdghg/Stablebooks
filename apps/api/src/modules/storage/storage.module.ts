import { Global, Module } from "@nestjs/common";
import { AuthRuntimeRepository } from "./auth-runtime.repository";
import { ArcEvidenceRepository } from "./arc-evidence.repository";
import { PostgresReadinessService } from "./postgres-readiness.service";
import { PrismaService } from "./prisma.service";
import { StorageService } from "./storage.service";
import { WebhookDeliveryRepository } from "./webhook-delivery.repository";
import { WorkspaceReadRepository } from "./workspace-read.repository";

@Global()
@Module({
  providers: [
    StorageService,
    PrismaService,
    AuthRuntimeRepository,
    PostgresReadinessService,
    ArcEvidenceRepository,
    WebhookDeliveryRepository,
    WorkspaceReadRepository
  ],
  exports: [
    StorageService,
    PrismaService,
    AuthRuntimeRepository,
    PostgresReadinessService,
    ArcEvidenceRepository,
    WebhookDeliveryRepository,
    WorkspaceReadRepository
  ]
})
export class StorageModule {}
