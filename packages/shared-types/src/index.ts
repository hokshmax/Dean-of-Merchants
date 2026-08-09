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
 * A single AI-generated design. Images are generated on demand (Imagen) and referenced by a
 * publicly reachable URL served from this app's own API.
 */
export const DesignSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  imageUrl: z.string().url(),
  createdAt: z.coerce.date(),
});
export type Design = z.infer<typeof DesignSchema>;

/** A single buyable t-shirt size, priced at the in-house base cost plus margin. */
export const SizeOptionSchema = z.object({
  size: z.string(),
  retailPrice: MoneySchema,
});
export type SizeOption = z.infer<typeof SizeOptionSchema>;

/** Fixed t-shirt color palette shown as visual swatches -- color is cosmetic only (fulfillment
 * is manual/in-house, so it doesn't affect price or catalog lookups the way size does). */
export const TSHIRT_COLORS = [
  { name: "Black", hex: "#111111" },
  { name: "White", hex: "#f5f5f5" },
  { name: "Navy", hex: "#1e3a5f" },
  { name: "Red", hex: "#c0392b" },
  { name: "Gray", hex: "#888888" },
] as const;
export type TShirtColorName = (typeof TSHIRT_COLORS)[number]["name"];

export const OrderStatusSchema = z.enum(["PENDING_PAYMENT", "PAID", "IN_PRODUCTION", "SHIPPED", "CANCELED"]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  designId: z.string(),
  imageUrl: z.string().url(),
  size: z.string(),
  color: z.string(),
  quantity: z.number().int().min(1),
  retailPrice: MoneySchema,
  // Collected up front, before the payment redirect -- Tap's hosted page only handles payment,
  // not shipping details.
  recipientEmail: z.string().email().optional(),
  shippingAddress: AddressSchema.optional(),
  status: OrderStatusSchema,
  paymentReference: z.string().optional(),
  trackingCarrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  createdAt: z.coerce.date(),
});
export type Order = z.infer<typeof OrderSchema>;
