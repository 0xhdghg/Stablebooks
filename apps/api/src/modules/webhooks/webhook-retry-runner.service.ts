import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";

@Injectable()
export class WebhookRetryRunnerService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;

  constructor(private readonly webhooksService: WebhooksService) {}

  onModuleInit() {
    const intervalMs = this.getIntervalMs();
    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    if (this.inFlight) {
      return;
    }

    this.inFlight = true;
    try {
      await this.webhooksService.processDueRetries();
    } finally {
      this.inFlight = false;
    }
  }

  private getIntervalMs() {
    const value = Number(process.env.STABLEBOOKS_WEBHOOK_RETRY_SWEEP_MS ?? "3000");
    return Number.isFinite(value) && value >= 500 ? Math.floor(value) : 3000;
  }
}
