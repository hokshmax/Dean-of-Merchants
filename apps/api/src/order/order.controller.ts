import { BadRequestException, Body, Controller, Get, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { AddressSchema } from "@dean/shared-types";
import { OrderService } from "./order.service";

const createCheckoutSessionSchema = z.object({
  designId: z.string().min(1),
  size: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
  recipientEmail: z.string().email(),
  shippingAddress: AddressSchema,
});

const tapWebhookSchema = z.object({ id: z.string().min(1) });

@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get("sizes")
  getSizes() {
    return { sizes: this.orderService.listSizes() };
  }

  @Post("checkout")
  async createCheckout(@Body() body: unknown) {
    const parsed = createCheckoutSessionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.orderService.createCheckoutSession(parsed.data);
  }

  @Get(":id")
  async getOrder(@Param("id") id: string) {
    return { order: await this.orderService.getOrderById(id) };
  }

  @Post("webhook")
  async handleWebhook(@Body() body: unknown) {
    const parsed = tapWebhookSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.orderService.handleTapWebhook(parsed.data.id);
    return { received: true };
  }
}
