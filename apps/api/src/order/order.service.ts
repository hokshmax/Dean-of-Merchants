import { Injectable, NotFoundException } from "@nestjs/common";
import Stripe from "stripe";
import { createPrintfulClient, type PrintfulClient } from "@dean/pod-fulfillment";
import { calculateRetailPrice } from "@dean/pricing-engine";
import { getPrismaClient } from "@dean/db";
import { loadEnv } from "@dean/config";
import { createLogger } from "@dean/logger";
import type { Address, PrintfulVariant } from "@dean/shared-types";

const logger = createLogger("api:order");

// A modest, expandable set of countries Stripe's hosted Checkout can collect a shipping
// address for. Not exhaustive -- widen this list as real demand shows up from other countries.
const SHIPPABLE_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] = [
  "US", "CA", "GB", "AU", "DE", "FR", "IE", "NL", "ES", "IT",
];

export interface CreateCheckoutSessionInput {
  designId: string;
  variantId: number;
  quantity: number;
}

@Injectable()
export class OrderService {
  private readonly stripe: Stripe;
  private readonly printful: PrintfulClient;
  private readonly marginRate: number;
  private readonly webUrl: string;
  private readonly webhookSecret: string;

  constructor() {
    const env = loadEnv();
    if (!env.STRIPE_SECRET_KEY) {
      logger.warn("STRIPE_SECRET_KEY is not set; checkout will fail until it's configured");
    }
    if (!env.PRINTFUL_API_KEY) {
      logger.warn("PRINTFUL_API_KEY is not set; order fulfillment will fail until it's configured");
    }
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "");
    this.printful = createPrintfulClient(env.PRINTFUL_API_KEY ?? "", env.PRINTFUL_TSHIRT_PRODUCT_ID);
    this.marginRate = env.MARGIN_RATE;
    this.webUrl = env.WEB_PUBLIC_URL.replace(/\/+$/, "");
    this.webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? "";
  }

  async listVariants(): Promise<(PrintfulVariant & { retailPrice: PrintfulVariant["baseCost"] })[]> {
    const variants = await this.printful.listTShirtVariants();
    return variants.map((variant) => ({
      ...variant,
      retailPrice: calculateRetailPrice({ baseCost: variant.baseCost, marginRate: this.marginRate }).retailPrice,
    }));
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<{ checkoutUrl: string }> {
    const prisma = getPrismaClient();
    const design = await prisma.design.findUnique({ where: { id: input.designId } });
    if (!design) throw new NotFoundException(`Design "${input.designId}" not found`);

    const variants = await this.printful.listTShirtVariants();
    const variant = variants.find((v) => v.variantId === input.variantId);
    if (!variant) throw new NotFoundException(`Printful variant "${input.variantId}" not found`);

    const { retailPrice } = calculateRetailPrice({ baseCost: variant.baseCost, marginRate: this.marginRate });

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: retailPrice.currency.toLowerCase(),
            product_data: {
              name: `Custom design t-shirt (${variant.size}, ${variant.color})`,
              images: [design.imageUrl],
            },
            unit_amount: retailPrice.amountMinorUnits,
          },
          quantity: input.quantity,
        },
      ],
      shipping_address_collection: { allowed_countries: SHIPPABLE_COUNTRIES },
      success_url: `${this.webUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.webUrl}/chat`,
      metadata: { designId: input.designId, variantId: String(input.variantId), quantity: String(input.quantity) },
    });

    await prisma.order.create({
      data: {
        designId: input.designId,
        variantId: input.variantId,
        quantity: input.quantity,
        retailPriceAmountMinorUnits: retailPrice.amountMinorUnits,
        currency: retailPrice.currency,
        status: "PENDING_PAYMENT",
        stripeCheckoutSessionId: session.id,
      },
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { checkoutUrl: session.url };
  }

  /**
   * Verifies and handles a Stripe webhook event. Only "checkout.session.completed" triggers
   * real work (marking the order paid and submitting it to Printful); every other event type
   * is accepted and ignored, since Stripe retries on non-2xx responses.
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
    const order = await prisma.order.findUnique({
      where: { stripeCheckoutSessionId: session.id },
      include: { design: true },
    });
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

    try {
      const printfulOrder = await this.printful.createOrder({
        variantId: order.variantId,
        quantity: order.quantity,
        designImageUrl: order.design.imageUrl,
        recipient,
        recipientEmail: recipientEmail ?? "",
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "SUBMITTED_TO_PRINTFUL", printfulOrderId: printfulOrder.printfulOrderId },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ orderId: order.id, err: message }, "Printful order submission failed after payment -- needs manual follow-up");
      await prisma.order.update({ where: { id: order.id }, data: { status: "FULFILLMENT_FAILED" } });
    }
  }
}
