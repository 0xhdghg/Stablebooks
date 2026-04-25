import { Controller, Get, Param, Post } from "@nestjs/common";
import { PublicService } from "./public.service";

@Controller("public/invoices")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get(":publicToken")
  async getInvoice(@Param("publicToken") publicToken: string) {
    return {
      data: await this.publicService.getInvoice(publicToken)
    };
  }

  @Get(":publicToken/status")
  async getStatus(@Param("publicToken") publicToken: string) {
    return {
      data: await this.publicService.getStatus(publicToken)
    };
  }

  @Post(":publicToken/payment-session")
  async createPaymentSession(@Param("publicToken") publicToken: string) {
    return {
      data: await this.publicService.createPaymentSession(publicToken)
    };
  }
}
