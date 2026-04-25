import { Module } from "@nestjs/common";
import { WalletsController } from "./wallets.controller";
import { WalletsService } from "./wallets.service";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [WalletsController],
  providers: [WalletsService]
})
export class WalletsModule {}
