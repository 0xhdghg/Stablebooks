import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: buildAllowedOrigins(),
    credentials: true
  });

  app.setGlobalPrefix("api/v1");
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}

function buildAllowedOrigins() {
  const defaults = ["http://localhost:3000", "http://127.0.0.1:3000"];
  const configured = [
    process.env.APP_BASE_URL,
    ...(process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [])
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return [...new Set([...defaults, ...configured])];
}

void bootstrap();
