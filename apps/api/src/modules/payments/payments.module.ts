import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { PaymentConfirmationService } from "./payment-confirmation.service";
import { PaymentMatchingService } from "./payment-matching.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { RawChainIngestionService } from "./raw-chain-ingestion.service";

@Module({
  imports: [AuthModule, WebhooksModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentMatchingService,
    PaymentConfirmationService,
    RawChainIngestionService
  ],
  exports: [PaymentsService, RawChainIngestionService]
})
export class PaymentsModule {}
