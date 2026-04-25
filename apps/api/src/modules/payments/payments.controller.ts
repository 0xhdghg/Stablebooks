import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { AuthUser } from "../auth/auth-user.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @UseGuards(AuthGuard)
  async listByInvoice(
    @AuthUser() auth: CurrentAuth,
    @Query("invoiceId") invoiceId?: string
  ) {
    return {
      data: invoiceId ? await this.paymentsService.listByInvoiceId(auth, invoiceId) : []
    };
  }

  @Get("webhook-deliveries")
  @UseGuards(AuthGuard)
  async listWebhookDeliveries(
    @AuthUser() auth: CurrentAuth,
    @Query("status") status?: string,
    @Query("queue") queue?: "all" | "active" | "dead_letter"
  ) {
    const result = await this.paymentsService.listWebhookDeliveries(auth, {
      status,
      queue
    });

    return {
      data: result.records,
      meta: result.meta
    };
  }

  @Get(":paymentId")
  @UseGuards(AuthGuard)
  async getById(
    @AuthUser() auth: CurrentAuth,
    @Param("paymentId") paymentId: string
  ) {
    return {
      data: await this.paymentsService.getById(auth, paymentId)
    };
  }

  @Post(":paymentId/finalize")
  @UseGuards(AuthGuard)
  async finalize(
    @AuthUser() auth: CurrentAuth,
    @Param("paymentId") paymentId: string,
    @Body() body: { settlementReference?: string }
  ) {
    return {
      data: await this.paymentsService.finalize(auth, paymentId, body)
    };
  }

  @Post(":paymentId/fail")
  @UseGuards(AuthGuard)
  async fail(
    @AuthUser() auth: CurrentAuth,
    @Param("paymentId") paymentId: string,
    @Body() body: { failureReason?: string }
  ) {
    return {
      data: await this.paymentsService.fail(auth, paymentId, body)
    };
  }

  @Post("webhook-deliveries/:deliveryId/retry")
  @UseGuards(AuthGuard)
  async retryWebhookDelivery(
    @AuthUser() auth: CurrentAuth,
    @Param("deliveryId") deliveryId: string
  ) {
    return {
      data: await this.paymentsService.retryWebhookDelivery(auth, deliveryId)
    };
  }

  @Post(":paymentId/webhook-replay")
  @UseGuards(AuthGuard)
  async replayWebhook(
    @AuthUser() auth: CurrentAuth,
    @Param("paymentId") paymentId: string
  ) {
    return {
      data: await this.paymentsService.replayWebhook(auth, paymentId)
    };
  }

  @Post("mock/chain-confirmation")
  async confirmFromMockChain(
    @Headers("x-mock-chain-key") chainKey: string | undefined,
    @Body()
    body: {
      paymentId?: string;
      publicToken?: string;
      txHash?: string;
      blockNumber?: number;
      settlementReference?: string;
    }
  ) {
    if (chainKey !== this.getMockChainKey()) {
      throw new UnauthorizedException("Invalid mock chain key.");
    }

    return {
      data: await this.paymentsService.confirmFromMockChain(body)
    };
  }

  @Post("mock/chain-observation")
  async ingestMockObservation(
    @Headers("x-mock-chain-key") chainKey: string | undefined,
    @Body()
    body: {
      paymentId?: string;
      publicToken?: string;
      txHash?: string;
      blockNumber?: number;
      from: string;
      to?: string;
      token: string;
      amount: string;
      decimals: number;
      chainId: number;
      rawPayload?: Record<string, unknown>;
    }
  ) {
    if (chainKey !== this.getMockChainKey()) {
      throw new UnauthorizedException("Invalid mock chain key.");
    }

    return {
      data: await this.paymentsService.ingestMockObservation(body)
    };
  }

  @Post("mock/raw-chain-event")
  async ingestMockRawChainEvent(
    @Headers("x-mock-chain-key") chainKey: string | undefined,
    @Body()
    body: {
      txHash?: string;
      logIndex?: number;
      blockNumber?: number;
      blockTimestamp?: string;
      confirmedAt?: string;
      from: string;
      to: string;
      token: string;
      amount: string;
      decimals: number;
      chainId: number;
      rawPayload?: Record<string, unknown>;
    }
  ) {
    if (chainKey !== this.getMockChainKey()) {
      throw new UnauthorizedException("Invalid mock chain key.");
    }

    return {
      data: await this.paymentsService.ingestMockRawChainEvent(body)
    };
  }

  @Post("mock/observations/:observationId/match")
  async matchStoredObservation(
    @Headers("x-mock-chain-key") chainKey: string | undefined,
    @Param("observationId") observationId: string,
    @Body() body: { paymentId?: string; publicToken?: string }
  ) {
    if (chainKey !== this.getMockChainKey()) {
      throw new UnauthorizedException("Invalid mock chain key.");
    }

    return {
      data: await this.paymentsService.matchStoredObservation({
        observationId,
        paymentId: body.paymentId,
        publicToken: body.publicToken
      })
    };
  }

  @Post("mock/observations/:observationId/confirm")
  async confirmMatchedObservation(
    @Headers("x-mock-chain-key") chainKey: string | undefined,
    @Param("observationId") observationId: string,
    @Body() body: { settlementReference?: string }
  ) {
    if (chainKey !== this.getMockChainKey()) {
      throw new UnauthorizedException("Invalid mock chain key.");
    }

    return {
      data: await this.paymentsService.confirmMatchedObservation({
        observationId,
        settlementReference: body.settlementReference
      })
    };
  }

  @Post("mock/observations/:observationId/fail")
  async failMatchedObservation(
    @Headers("x-mock-chain-key") chainKey: string | undefined,
    @Param("observationId") observationId: string,
    @Body() body: { failureReason?: string }
  ) {
    if (chainKey !== this.getMockChainKey()) {
      throw new UnauthorizedException("Invalid mock chain key.");
    }

    return {
      data: await this.paymentsService.failMatchedObservation({
        observationId,
        failureReason: body.failureReason
      })
    };
  }

  @Post("mock/chain-failure")
  async failFromMockChain(
    @Headers("x-mock-chain-key") chainKey: string | undefined,
    @Body()
    body: {
      paymentId?: string;
      publicToken?: string;
      txHash?: string;
      blockNumber?: number;
      failureReason?: string;
    }
  ) {
    if (chainKey !== this.getMockChainKey()) {
      throw new UnauthorizedException("Invalid mock chain key.");
    }

    return {
      data: await this.paymentsService.failFromMockChain(body)
    };
  }

  private getMockChainKey() {
    return process.env.MOCK_CHAIN_API_KEY?.trim() || "stablebooks-dev-chain-key";
  }
}
