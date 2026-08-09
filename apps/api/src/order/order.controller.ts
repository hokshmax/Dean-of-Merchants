import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req, type RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { OrderService } from "./order.service";

const createCheckoutSessionSchema = z.object({
  designId: z.string().min(1),
  size: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
});

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

  @Get("by-session/:sessionId")
  async getOrderBySession(@Param("sessionId") sessionId: string) {
    return this.orderService.getOrderIdBySession(sessionId);
  }

  @Get(":id")
  async getOrder(@Param("id") id: string) {
    return { order: await this.orderService.getOrderById(id) };
  }

  @Post("webhook")
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string | undefined,
  ) {
    if (!signature || !req.rawBody) {
      throw new BadRequestException("Missing Stripe signature or raw body");
    }
    await this.orderService.handleStripeWebhook(req.rawBody, signature);
    return { received: true };
  }
}
