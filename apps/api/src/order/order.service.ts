import { Injectable, NotFoundException } from "@nestjs/common";
import Stripe from "stripe";
import { calculateRetailPrice } from "@dean/pricing-engine";
import { getPrismaClient } from "@dean/db";
import { loadEnv } from "@dean/config";
import { createLogger } from "@dean/logger";
import type { Address, SizeOption } from "@dean/shared-types";

const logger = createLogger("api:order");

const SIZES = ["S", "M", "L", "XL", "XXL"] as const;

// A modest, expandable set of countries Stripe's hosted Checkout can collect a shipping
// address for. Not exhaustive -- widen this list as real demand shows up from other countries.
const SHIPPABLE_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] = [
  "US", "CA", "GB", "AU", "DE", "FR", "IE", "NL", "ES", "IT",
];

export interface CreateCheckoutSessionInput {
  designId: string;
  size: string;
  quantity: number;
}

@Injectable()
export class OrderService {
  private readonly stripe: Stripe;
  private readonly baseCostMinorUnits: number;
  private readonly marginRate: number;
  private readonly webUrl: string;
  private readonly webhookSecret: string;

  constructor() {
    const env = loadEnv();
    if (!env.STRIPE_SECRET_KEY) {
      logger.warn("STRIPE_SECRET_KEY is not set; checkout will fail until it's configured");
    }
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "");
    this.baseCostMinorUnits = env.BASE_PRODUCT_COST_MINOR_UNITS;
    this.marginRate = env.MARGIN_RATE;
    this.webUrl = env.WEB_PUBLIC_URL.replace(/\/+$/, "");
    this.webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? "";
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

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: sizeOption.retailPrice.currency.toLowerCase(),
            product_data: {
              name: `Custom design t-shirt (${input.size})`,
              images: [design.imageUrl],
            },
            unit_amount: sizeOption.retailPrice.amountMinorUnits,
          },
          quantity: input.quantity,
        },
      ],
      shipping_address_collection: { allowed_countries: SHIPPABLE_COUNTRIES },
      success_url: `${this.webUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.webUrl}/chat`,
      metadata: { designId: input.designId, size: input.size, quantity: String(input.quantity) },
    });

    const order = await prisma.order.create({
      data: {
        designId: input.designId,
        size: input.size,
        quantity: input.quantity,
        retailPriceAmountMinorUnits: sizeOption.retailPrice.amountMinorUnits,
        currency: sizeOption.retailPrice.currency,
        status: "PENDING_PAYMENT",
        stripeCheckoutSessionId: session.id,
      },
    });
    logger.info({ orderId: order.id, sessionId: session.id }, "checkout session created");

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { checkoutUrl: session.url };
  }

  /**
   * Verifies and handles a Stripe webhook event. Only "checkout.session.completed" triggers
   * real work (marking the order paid and recording the shipping address); every other event
   * type is accepted and ignored, since Stripe retries on non-2xx responses. Fulfillment itself
   * (printing, shipping, tracking) happens in-house from here on, driven manually through the
   * admin dashboard rather than an external API.
   *
   * Note on Stripe's shipping-address field name: this reads `session.shipping_details`, the
   * field name Stripe's newer API versions use once shipping_address_collection is set;
   * unverified against a live webhook since no real Stripe test keys exist yet to fire one --
   * check this against a real event payload once STRIPE_SECRET_KEY is configured.
   */
  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);

    if (event.type !== "checkout.session.completed") {
      logger.debug({ type: event.type }, "ignoring unhandled Stripe webhook event type");
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const prisma = getPrismaClient();
    const order = await prisma.order.findUnique({ where: { stripeCheckoutSessionId: session.id } });
    if (!order) {
      logger.warn({ sessionId: session.id }, "checkout.session.completed for an unknown order");
      return;
    }

    const shipping = session.shipping_details;
    const recipient: Address = {
      name: shipping?.name ?? session.customer_details?.name ?? "",
      line1: shipping?.address?.line1 ?? "",
      line2: shipping?.address?.line2 ?? undefined,
      city: shipping?.address?.city ?? "",
      region: shipping?.address?.state ?? undefined,
      postalCode: shipping?.address?.postal_code ?? "",
      countryCode: shipping?.address?.country ?? "",
    };
    const recipientEmail = session.customer_details?.email ?? undefined;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        recipientEmail,
        shippingName: recipient.name,
        shippingLine1: recipient.line1,
        shippingLine2: recipient.line2,
        shippingCity: recipient.city,
        shippingRegion: recipient.region,
        shippingPostalCode: recipient.postalCode,
        shippingCountryCode: recipient.countryCode,
      },
    });
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

  /** Resolves a Stripe checkout session id to the order it created, for the post-payment redirect. */
  async getOrderIdBySession(sessionId: string): Promise<{ orderId: string }> {
    const order = await getPrismaClient().order.findUnique({
      where: { stripeCheckoutSessionId: sessionId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException(`No order found for session "${sessionId}"`);
    return { orderId: order.id };
  }
}
