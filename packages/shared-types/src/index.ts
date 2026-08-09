import { z } from "zod";

export const MoneySchema = z.object({
  amountMinorUnits: z.number().int(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof MoneySchema>;

export const AddressSchema = z.object({
  name: z.string(),
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  region: z.string().optional(),
  postalCode: z.string(),
  countryCode: z.string().length(2),
});
export type Address = z.infer<typeof AddressSchema>;

/**
 * A single AI-generated design. Images are generated on demand (Imagen) and referenced by URL
 * once uploaded somewhere Printful's order API can fetch them from -- Printful requires a
 * publicly reachable image URL, not inline bytes, when placing an order.
 */
export const DesignSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  imageUrl: z.string().url(),
  createdAt: z.coerce.date(),
});
export type Design = z.infer<typeof DesignSchema>;

/**
 * A single buyable product option from Printful's catalog -- one product/size/color
 * combination, with the base cost Printful charges to print and ship it (before margin).
 */
export const PrintfulVariantSchema = z.object({
  variantId: z.number().int(),
  productName: z.string(),
  size: z.string(),
  color: z.string(),
  baseCost: MoneySchema,
});
export type PrintfulVariant = z.infer<typeof PrintfulVariantSchema>;

export const OrderStatusSchema = z.enum([
  "PENDING_PAYMENT",
  "PAID",
  "SUBMITTED_TO_PRINTFUL",
  "FULFILLMENT_FAILED",
  "IN_PRODUCTION",
  "SHIPPED",
  "CANCELED",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  designId: z.string(),
  imageUrl: z.string().url(),
  variantId: z.number().int(),
  quantity: z.number().int().min(1),
  retailPrice: MoneySchema,
  // Unknown until Stripe Checkout completes -- its hosted page collects both itself.
  recipientEmail: z.string().email().optional(),
  shippingAddress: AddressSchema.optional(),
  status: OrderStatusSchema,
  stripeCheckoutSessionId: z.string().optional(),
  printfulOrderId: z.string().optional(),
  createdAt: z.coerce.date(),
});
export type Order = z.infer<typeof OrderSchema>;
