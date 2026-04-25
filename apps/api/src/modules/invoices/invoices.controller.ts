import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthUser } from "../auth/auth-user.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth";
import { InvoicesService } from "./invoices.service";

@Controller("invoices")
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async list(@AuthUser() auth: CurrentAuth) {
    return {
      data: await this.invoicesService.list(auth)
    };
  }

  @Get(":invoiceId")
  async getById(
    @AuthUser() auth: CurrentAuth,
    @Param("invoiceId") invoiceId: string
  ) {
    return {
      data: await this.invoicesService.getById(auth, invoiceId)
    };
  }

  @Post()
  async create(
    @AuthUser() auth: CurrentAuth,
    @Body()
    body: {
      customerId: string;
      amountMinor: number;
      currency: string;
      dueAt: string;
      memo: string;
      internalNote: string;
      publish: boolean;
    }
  ) {
    return {
      data: await this.invoicesService.create(auth, body)
    };
  }
}
