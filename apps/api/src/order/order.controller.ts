import { BadRequestException, Body, Controller, Get, Headers, Post, Req, type RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { OrderService } from "./order.service";

const createCheckoutSessionSchema = z.object({
  designId: z.string().min(1),
  variantId: z.number().int(),
  quantity: z.number().int().min(1).max(10).default(1),
});

@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get("variants")
  async getVariants() {
    return { variants: await this.orderService.listVariants() };
  }

  @Post("checkout")
  async createCheckout(@Body() body: unknown) {
    const parsed = createCheckoutSessionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.orderService.createCheckoutSession(parsed.data);
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
