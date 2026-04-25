import { Module } from "@nestjs/common";
import { ArcModule } from "./modules/arc/arc.module";
import { HealthModule } from "./modules/health/health.module";
import { StorageModule } from "./modules/storage/storage.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { WalletsModule } from "./modules/wallets/wallets.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { PublicModule } from "./modules/public/public.module";
import { PaymentsModule } from "./modules/payments/payments.module";

@Module({
  imports: [
    StorageModule,
    ArcModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    WalletsModule,
    CustomersModule,
    InvoicesModule,
    PaymentsModule,
    PublicModule
  ]
})
export class AppModule {}
