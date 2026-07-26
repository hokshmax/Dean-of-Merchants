import { z } from "zod";

export const MoneySchema = z.object({
  amountMinorUnits: z.number().int(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof MoneySchema>;

export const AddressSchema = z.object({
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  region: z.string().optional(),
  postalCode: z.string(),
  countryCode: z.string().length(2),
});
export type Address = z.infer<typeof AddressSchema>;

export const ProductConditionSchema = z.enum(["new", "used", "any"]);
export type ProductCondition = z.infer<typeof ProductConditionSchema>;

export const ProductQuerySchema = z.object({
  rawQuery: z.string(),
  brand: z.string().optional(),
  model: z.string().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  budgetMaxMinorUnits: z.number().int().optional(),
  currency: z.string().length(3).default("USD"),
  destinationCountryCode: z.string().length(2),
  condition: ProductConditionSchema.default("any"),
});
export type ProductQuery = z.infer<typeof ProductQuerySchema>;

export const SearchOptionsSchema = z.object({
  timeoutMs: z.number().int().default(15_000),
  maxResults: z.number().int().default(5),
});
export type SearchOptions = z.infer<typeof SearchOptionsSchema>;

export const RetailerOfferResultSchema = z.object({
  retailerId: z.string(),
  retailerName: z.string(),
  offerId: z.string(),
  title: z.string(),
  url: z.string().url(),
  imageUrl: z.string().url().optional(),
  price: MoneySchema,
  availability: z.enum(["in_stock", "out_of_stock", "unknown"]),
  scrapedAt: z.coerce.date(),
  rawSnapshot: z.unknown().optional(),
});
export type RetailerOfferResult = z.infer<typeof RetailerOfferResultSchema>;

export const ShippingTaxEstimateSchema = z.object({
  shippingCost: MoneySchema,
  taxAmount: MoneySchema,
  estimatedDeliveryDays: z.number().int().optional(),
});
export type ShippingTaxEstimate = z.infer<typeof ShippingTaxEstimateSchema>;

export const QuoteBreakdownSchema = z.object({
  quoteId: z.string(),
  offerId: z.string(),
  retailerId: z.string(),
  productPrice: MoneySchema,
  shippingCost: MoneySchema,
  taxAmount: MoneySchema,
  platformFeeRate: z.number(),
  platformFee: MoneySchema,
  landedCost: MoneySchema,
  totalCharge: MoneySchema,
  currency: z.string().length(3),
  quotedAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
});
export type QuoteBreakdown = z.infer<typeof QuoteBreakdownSchema>;

export const AdapterHealthStatusSchema = z.object({
  retailerId: z.string(),
  status: z.enum(["healthy", "degraded", "down"]),
  lastSuccessAt: z.coerce.date().optional(),
  lastFailureAt: z.coerce.date().optional(),
  rollingFailureRate: z.number().min(0).max(1),
});
export type AdapterHealthStatus = z.infer<typeof AdapterHealthStatusSchema>;

export const CheckoutInputSchema = z.object({
  offerId: z.string(),
  quoteId: z.string(),
  shippingAddress: AddressSchema,
  buyerEmail: z.string().email(),
  maxPrice: MoneySchema,
});
export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;

export const CheckoutResultSchema = z.object({
  success: z.boolean(),
  retailerOrderId: z.string().optional(),
  finalPrice: MoneySchema.optional(),
  failureReason: z.string().optional(),
});
export type CheckoutResult = z.infer<typeof CheckoutResultSchema>;

export const OfferQuoteSchema = z.object({
  offer: RetailerOfferResultSchema,
  quote: QuoteBreakdownSchema,
});
export type OfferQuote = z.infer<typeof OfferQuoteSchema>;

export const OrderStatusSchema = z.enum([
  "QUOTE_GENERATED",
  "PAYMENT_PENDING",
  "PAYMENT_FAILED",
  "PAID",
  "PRICE_REVALIDATION",
  "PRICE_CHANGED_REFUND_PENDING",
  "PURCHASE_IN_PROGRESS",
  "PURCHASE_FAILED",
  "MANUAL_INTERVENTION_QUEUED",
  "PURCHASED",
  "SHIPPED",
  "DELIVERED",
  "REFUNDED",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
