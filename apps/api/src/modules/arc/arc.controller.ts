import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException
} from "@nestjs/common";
import { ArcAdapterService } from "./arc-adapter.service";
import { ArcConfigService } from "./arc-config.service";
import { CircleWebhookVerifierService } from "./circle-webhook-verifier.service";
import { ArcEvidenceRepository } from "../storage/arc-evidence.repository";

@Controller("arc")
export class ArcController {
  constructor(
    private readonly arcAdapter: ArcAdapterService,
    private readonly arcConfig: ArcConfigService,
    private readonly circleWebhookVerifier: CircleWebhookVerifierService,
    private readonly arcEvidenceRepository: ArcEvidenceRepository
  ) {}

  @Get("dev/readiness")
  getReadiness(@Headers("x-arc-dev-key") devKey: string | undefined) {
    this.assertDevKey(devKey);

    return {
      data: this.arcAdapter.getReadiness()
    };
  }

  @Get("dev/state")
  getState(@Headers("x-arc-dev-key") devKey: string | undefined) {
    this.assertDevKey(devKey);

    const config = this.arcConfig.getRuntimeConfig();
    const readiness = this.arcAdapter.getReadiness();
    const fixtures = this.arcAdapter.listFixtureNames();

    return {
      data: {
        enabled: config.enabled,
        sourceKind: config.sourceKind,
        chainId: config.chainId,
        hasRpcUrl: Boolean(config.rpcUrl),
        hasWebhookSecret: Boolean(config.webhookSecret),
        pollIntervalMs: config.pollIntervalMs,
        confirmationsRequired: config.confirmationsRequired,
        startBlock: config.startBlock,
        sourceProfile: config.sourceProfile,
        readiness,
        fixtureCount: fixtures.length,
        fixtures
      }
    };
  }

  @Get("dev/fixtures")
  listFixtures(@Headers("x-arc-dev-key") devKey: string | undefined) {
    this.assertDevKey(devKey);

    return {
      data: this.arcAdapter.listFixtureNames()
    };
  }

  @Get("dev/evidence-store")
  async getEvidenceStore(@Headers("x-arc-dev-key") devKey: string | undefined) {
    this.assertDevKey(devKey);

    return {
      data: {
        backend: "postgres",
        summary: await this.arcEvidenceRepository.getSummary()
      }
    };
  }

  @Post("dev/ingest")
  async ingestProviderPayload(
    @Headers("x-arc-dev-key") devKey: string | undefined,
    @Body() body: unknown
  ) {
    this.assertDevKey(devKey);

    return {
      data: await this.arcAdapter.ingestProviderEvent(body)
    };
  }

  @Post("dev/fixtures/:fixtureName/ingest")
  async ingestFixture(
    @Headers("x-arc-dev-key") devKey: string | undefined,
    @Param("fixtureName") fixtureName: string,
    @Body() body: Partial<{
      txHash: string;
      blockNumber: number;
      confirmedAt: string;
      from: string;
      to: string;
      token: string;
      amount: string;
      decimals: number;
      chainId: number;
      logIndex: number;
      blockTimestamp: string | null;
      rawPayload: Record<string, unknown>;
    }>
  ) {
    this.assertDevKey(devKey);

    return {
      data: await this.arcAdapter.ingestFixture(fixtureName, body)
    };
  }

  @Post("webhooks/events")
  async ingestWebhookEvent(
    @Headers("x-arc-webhook-secret") webhookSecret: string | undefined,
    @Headers("x-circle-key-id") circleKeyId: string | undefined,
    @Headers("x-circle-signature") circleSignature: string | undefined,
    @Req() request: { rawBody?: Buffer },
    @Body() body: unknown
  ) {
    if (circleKeyId || circleSignature) {
      this.assertWebhookRuntimeEnabled();
      await this.circleWebhookVerifier.verifyOrThrow({
        keyId: circleKeyId,
        signature: circleSignature,
        rawBody: request.rawBody
      });

      return {
        data: await this.ingestCircleNotification(body)
      };
    }

    this.assertWebhookSecret(webhookSecret);

    return {
      data: await this.arcAdapter.ingestProviderEvent(body)
    };
  }

  @Post("webhooks/finality")
  async ingestWebhookFinality(
    @Headers("x-arc-webhook-secret") webhookSecret: string | undefined,
    @Body() body: unknown
  ) {
    this.assertWebhookSecret(webhookSecret);

    return {
      data: await this.arcAdapter.ingestProviderFinalityEvent(body)
    };
  }

  private assertDevKey(devKey: string | undefined) {
    if (devKey !== this.arcConfig.getDevIngestKey()) {
      throw new UnauthorizedException("Invalid Arc dev ingest key.");
    }
  }

  private assertWebhookSecret(webhookSecret: string | undefined) {
    const config = this.arcConfig.getRuntimeConfig();

    if (!config.enabled) {
      throw new BadRequestException("Arc source is disabled.");
    }

    if (config.sourceKind !== "webhook") {
      throw new BadRequestException(
        "Arc source is not configured for webhook ingestion."
      );
    }

    if (!config.webhookSecret) {
      throw new UnauthorizedException("Arc webhook secret is not configured.");
    }

    if (webhookSecret !== config.webhookSecret) {
      throw new UnauthorizedException("Invalid Arc webhook secret.");
    }
  }

  private assertWebhookRuntimeEnabled() {
    const config = this.arcConfig.getRuntimeConfig();

    if (!config.enabled) {
      throw new BadRequestException("Arc source is disabled.");
    }

    if (config.sourceKind !== "webhook") {
      throw new BadRequestException(
        "Arc source is not configured for webhook ingestion."
      );
    }
  }

  private async ingestCircleNotification(body: unknown) {
    const notificationType = this.readCircleNotificationType(body);

    if (notificationType === "webhooks.test") {
      return {
        accepted: true,
        provider: "circle",
        notificationType,
        action: "acknowledged"
      };
    }

    if (notificationType === "contracts.eventLog") {
      return this.arcAdapter.ingestProviderEvent(body);
    }

    throw new BadRequestException({
      message: "Unsupported Circle webhook notification type.",
      rejectedReason: "unsupported_circle_notification_type",
      notificationType
    });
  }

  private readCircleNotificationType(body: unknown) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }

    const notificationType = (body as { notificationType?: unknown })
      .notificationType;
    return typeof notificationType === "string" ? notificationType : null;
  }
}
