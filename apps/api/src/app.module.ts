import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { ChatModule } from "./chat/chat.module";
import { SearchModule } from "./search/search.module";
import { QuotesController } from "./quotes/quotes.controller";

@Module({
  imports: [ChatModule, SearchModule],
  controllers: [HealthController, QuotesController],
})
export class AppModule {}
