import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadEnv } from "@dean/config";
import { createLogger } from "@dean/logger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const env = loadEnv();
  const logger = createLogger("api");

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(env.API_PORT);

  logger.info({ port: env.API_PORT }, "api listening");
}

bootstrap();
