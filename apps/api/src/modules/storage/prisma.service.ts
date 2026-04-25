import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import { join } from "node:path";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    loadLocalDatabaseEnv();
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

function loadLocalDatabaseEnv() {
  if (process.env.DATABASE_URL || typeof process.loadEnvFile !== "function") {
    return;
  }

  const candidates = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "apps", "api", ".env")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}
