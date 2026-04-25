import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthUser } from "../auth/auth-user.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async create(
    @AuthUser() auth: CurrentAuth,
    @Body()
    body: { name: string; billingCountry: string; baseCurrency: string }
  ) {
    return {
      data: await this.organizationsService.createForUser(auth, body)
    };
  }

  @Get("current")
  async getCurrent(@AuthUser() auth: CurrentAuth) {
    return {
      data: await this.organizationsService.getCurrent(auth)
    };
  }
}
