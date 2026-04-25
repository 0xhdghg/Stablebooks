import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { WebhookRetryRunnerService } from "./webhook-retry-runner.service";
import { WebhooksService } from "./webhooks.service";

@Module({
  imports: [StorageModule],
  providers: [WebhooksService, WebhookRetryRunnerService],
  exports: [WebhooksService]
})
export class WebhooksModule {}
