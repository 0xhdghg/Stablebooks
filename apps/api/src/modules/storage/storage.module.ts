import { Global, Module } from "@nestjs/common";
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
    PostgresReadinessService,
    ArcEvidenceRepository,
    WebhookDeliveryRepository,
    WorkspaceReadRepository
  ],
  exports: [
    StorageService,
    PrismaService,
    PostgresReadinessService,
    ArcEvidenceRepository,
    WebhookDeliveryRepository,
    WorkspaceReadRepository
  ]
})
export class StorageModule {}
