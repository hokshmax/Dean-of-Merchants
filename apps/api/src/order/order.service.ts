import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { calculateRetailPrice } from "@dean/pricing-engine";
import { getPrismaClient } from "@dean/db";
import { loadEnv } from "@dean/config";
import { createLogger } from "@dean/logger";
import type { Address, SizeOption } from "@dean/shared-types";
import { createTapClient, splitFullName } from "./tap-client";

const logger = createLogger("api:order");

const SIZES = ["S", "M", "L", "XL", "XXL"] as const;

export interface CreateCheckoutSessionInput {
  designId: string;
  size: string;
  quantity: number;
  recipientEmail: string;
  shippingAddress: Address;
}

@Injectable()
export class OrderService {
  // undefined (not a client constructed with an empty key) when TAP_SECRET_KEY is unset --
  // createCheckoutSession/handleTapWebhook throw a clear 503 instead of crashing the app at
  // boot the way constructing a payment SDK eagerly with an empty key can.
  private readonly tap: ReturnType<typeof createTapClient> | undefined;
  private readonly baseCostMinorUnits: number;
  private readonly marginRate: number;
  private readonly webUrl: string;
  private readonly apiUrl: string;

  constructor() {
    const env = loadEnv();
    if (!env.TAP_SECRET_KEY) {
      logger.warn("TAP_SECRET_KEY is not set; checkout will fail until it's configured");
    }
    this.tap = env.TAP_SECRET_KEY ? createTapClient(env.TAP_SECRET_KEY) : undefined;
    this.baseCostMinorUnits = env.BASE_PRODUCT_COST_MINOR_UNITS;
    this.marginRate = env.MARGIN_RATE;
    this.webUrl = env.WEB_PUBLIC_URL.replace(/\/+$/, "");
    this.apiUrl = env.API_PUBLIC_URL.replace(/\/+$/, "");
  }

  private requireTap() {
    if (!this.tap) throw new ServiceUnavailableException("Checkout is not configured (TAP_SECRET_KEY is unset)");
    return this.tap;
  }

  listSizes(): SizeOption[] {
    const { retailPrice } = calculateRetailPrice({
      baseCost: { amountMinorUnits: this.baseCostMinorUnits, currency: "USD" },
      marginRate: this.marginRate,
    });
    return SIZES.map((size) => ({ size, retailPrice }));
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<{ checkoutUrl: string }> {
    const prisma = getPrismaClient();
    const design = await prisma.design.findUnique({ where: { id: input.designId } });
    if (!design) throw new NotFoundException(`Design "${input.designId}" not found`);

    const sizeOption = this.listSizes().find((s) => s.size === input.size);
    if (!sizeOption) throw new NotFoundException(`Size "${input.size}" not available`);

    // Address is known up front here (unlike the old Stripe Checkout flow, which learned it
    // from the completed session) -- store it on the order immediately.
    const order = await prisma.order.create({
      data: {
        designId: input.designId,
        size: input.size,
        quantity: input.quantity,
        retailPriceAmountMinorUnits: sizeOption.retailPrice.amountMinorUnits,
        currency: sizeOption.retailPrice.currency,
        status: "PENDING_PAYMENT",
        recipientEmail: input.recipientEmail,
        shippingName: input.shippingAddress.name,
        shippingLine1: input.shippingAddress.line1,
        shippingLine2: input.shippingAddress.line2,
        shippingCity: input.shippingAddress.city,
        shippingRegion: input.shippingAddress.region,
        shippingPostalCode: input.shippingAddress.postalCode,
        shippingCountryCode: input.shippingAddress.countryCode,
      },
    });

    const tap = this.requireTap();
    const { firstName, lastName } = splitFullName(input.shippingAddress.name);
    const totalMinorUnits = sizeOption.retailPrice.amountMinorUnits * input.quantity;

    const charge = await tap.createCharge({
      amount: totalMinorUnits / 100,
      currency: sizeOption.retailPrice.currency,
      customer: { firstName, lastName, email: input.recipientEmail },
      redirectUrl: `${this.webUrl}/order/success?order_id=${order.id}`,
      postUrl: `${this.apiUrl}/orders/webhook`,
      orderReference: order.id,
    });

    await prisma.order.update({ where: { id: order.id }, data: { paymentReference: charge.id } });
    logger.info({ orderId: order.id, chargeId: charge.id }, "checkout charge created");

    if (!charge.redirectUrl) throw new Error("Tap did not return a checkout URL");
    return { checkoutUrl: charge.redirectUrl };
  }

  /**
   * Handles Tap's payment webhook notification. Rather than trusting the posted payload
   * directly (Tap supports HMAC-SHA256 payload signing, but the exact header/signing-string
   * spec wasn't confirmed against live docs), this re-fetches the charge by id from Tap's API
   * using our own secret key -- the authoritative source of truth -- and only marks the order
   * PAID once Tap itself confirms a CAPTURED status.
   */
  async handleTapWebhook(chargeId: string): Promise<void> {
    const charge = await this.requireTap().getCharge(chargeId);
    const prisma = getPrismaClient();
    const order = await prisma.order.findUnique({ where: { paymentReference: chargeId } });
    if (!order) {
      logger.warn({ chargeId }, "webhook for an unknown charge/order");
      return;
    }

    if (charge.status !== "CAPTURED") {
      logger.info({ orderId: order.id, status: charge.status }, "charge not captured, leaving order as-is");
      return;
    }

    await prisma.order.update({ where: { id: order.id }, data: { status: "PAID" } });
    logger.info({ orderId: order.id }, "order paid -- queued for manual fulfillment");
  }

  /**
   * Public order lookup by order id. There's no user/account system yet, so the order id
   * itself (a long, unguessable cuid) acts as the access token, same pattern as a typical
   * guest-checkout order-tracking link.
   */
  async getOrderById(id: string) {
    const order = await getPrismaClient().order.findUnique({ where: { id }, include: { design: true } });
    if (!order) throw new NotFoundException(`Order "${id}" not found`);
    return order;
  }
}
