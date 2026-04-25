import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthUser } from "../auth/auth-user.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth";
import { CustomersService } from "./customers.service";

@Controller("customers")
@UseGuards(AuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async list(@AuthUser() auth: CurrentAuth) {
    return {
      data: await this.customersService.list(auth)
    };
  }

  @Get(":customerId")
  async getById(
    @AuthUser() auth: CurrentAuth,
    @Param("customerId") customerId: string
  ) {
    return {
      data: await this.customersService.getById(auth, customerId)
    };
  }

  @Post()
  async create(
    @AuthUser() auth: CurrentAuth,
    @Body()
    body: { name: string; email: string; billingCurrency: string }
  ) {
    return {
      data: await this.customersService.create(auth, body)
    };
  }
}
