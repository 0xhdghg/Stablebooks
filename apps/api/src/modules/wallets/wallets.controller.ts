import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthUser } from "../auth/auth-user.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth";
import { WalletsService } from "./wallets.service";

@Controller("wallets")
@UseGuards(AuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  async list(@AuthUser() auth: CurrentAuth) {
    return {
      data: await this.walletsService.list(auth)
    };
  }

  @Post()
  async create(
    @AuthUser() auth: CurrentAuth,
    @Body()
    body: {
      chain: string;
      address: string;
      label: string;
      role: "collection" | "operating" | "reserve" | "payout";
      isDefaultSettlement: boolean;
    }
  ) {
    return {
      data: await this.walletsService.create(auth, body)
    };
  }
}
