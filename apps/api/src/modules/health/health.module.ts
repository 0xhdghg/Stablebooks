import { Module } from "@nestjs/common";
import { ArcModule } from "../arc/arc.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [ArcModule],
  controllers: [HealthController]
})
export class HealthModule {}
