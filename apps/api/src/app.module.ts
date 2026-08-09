import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { AdminModule } from "./admin/admin.module";
import { ChatModule } from "./chat/chat.module";
import { DesignModule } from "./design/design.module";
import { OrderModule } from "./order/order.module";

@Module({
  imports: [ChatModule, DesignModule, OrderModule, AdminModule],
  controllers: [HealthController],
})
export class AppModule {}
