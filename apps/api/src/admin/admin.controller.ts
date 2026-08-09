import { BadRequestException, Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { getPrismaClient } from "@dean/db";
import { AdminAuthGuard } from "./admin-auth.guard";

const updateOrderSchema = z.object({
  status: z.enum(["PENDING_PAYMENT", "PAID", "IN_PRODUCTION", "SHIPPED", "CANCELED"]).optional(),
  trackingCarrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().url().optional(),
});

@Controller("admin/orders")
@UseGuards(AdminAuthGuard)
export class AdminController {
  @Get()
  async listOrders() {
    const orders = await getPrismaClient().order.findMany({
      include: { design: true },
      orderBy: { createdAt: "desc" },
    });
    return { orders };
  }

  @Patch(":id")
  async updateOrder(@Param("id") id: string, @Body() body: unknown) {
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const order = await getPrismaClient().order.update({ where: { id }, data: parsed.data });
    return { order };
  }
}
