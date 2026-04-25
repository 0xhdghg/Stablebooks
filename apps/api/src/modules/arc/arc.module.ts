import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { ArcAdapterService } from "./arc-adapter.service";
import { ArcConfigService } from "./arc-config.service";
import { ArcController } from "./arc.controller";
import { ArcFixturesService } from "./arc-fixtures.service";
import { ArcEventNormalizerService } from "./arc-event-normalizer.service";
import { ArcProviderDecoderService } from "./arc-provider-decoder.service";

@Module({
  imports: [PaymentsModule],
  controllers: [ArcController],
  providers: [
    ArcConfigService,
    ArcFixturesService,
    ArcEventNormalizerService,
    ArcProviderDecoderService,
    ArcAdapterService
  ],
  exports: [
    ArcConfigService,
    ArcFixturesService,
    ArcEventNormalizerService,
    ArcProviderDecoderService,
    ArcAdapterService
  ]
})
export class ArcModule {}
