import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadEnv } from "@dean/config";
import { createLogger } from "@dean/logger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const env = loadEnv();
  const logger = createLogger("api");

  // rawBody:true keeps the raw request buffer available (req.rawBody) alongside the parsed
  // JSON body -- the Stripe webhook handler needs the exact raw bytes to verify its signature.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors();
  await app.listen(env.API_PORT);

  logger.info({ port: env.API_PORT }, "api listening");
}

bootstrap();
