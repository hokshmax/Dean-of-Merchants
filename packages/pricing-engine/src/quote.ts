import { randomUUID } from "node:crypto";
import type {
  Money,
  QuoteBreakdown,
  RetailerOfferResult,
  ShippingTaxEstimate,
} from "@dean/shared-types";
import { addMoney, multiplyMoney, money } from "./money";

export const DEFAULT_PLATFORM_FEE_RATE = 0.025;
export const DEFAULT_QUOTE_TTL_MS = 15 * 60 * 1000;

export interface BuildQuoteInput {
  offer: RetailerOfferResult;
  estimate: ShippingTaxEstimate;
  platformFeeRate?: number;
  quotedAt?: Date;
  ttlMs?: number;
}

/**
 * The platform fee is charged on product price only, never on shipping or tax.
 * This is a hard business rule enforced here rather than left to callers to get right.
 */
export function buildQuoteBreakdown(input: BuildQuoteInput): QuoteBreakdown {
  const {
    offer,
    estimate,
    platformFeeRate = DEFAULT_PLATFORM_FEE_RATE,
    quotedAt = new Date(),
    ttlMs = DEFAULT_QUOTE_TTL_MS,
  } = input;

  const currency = offer.price.currency;
  if (estimate.shippingCost.currency !== currency || estimate.taxAmount.currency !== currency) {
    throw new Error(
      `Currency mismatch building quote: offer=${currency}, shipping=${estimate.shippingCost.currency}, tax=${estimate.taxAmount.currency}`,
    );
  }

  const productPrice: Money = offer.price;
  const shippingCost = estimate.shippingCost;
  const taxAmount = estimate.taxAmount;
  const platformFee = multiplyMoney(productPrice, platformFeeRate);

  const landedCost = addMoney(addMoney(productPrice, shippingCost), taxAmount);
  const totalCharge = addMoney(landedCost, platformFee);

  return {
    quoteId: randomUUID(),
    offerId: offer.offerId,
    retailerId: offer.retailerId,
    productPrice,
    shippingCost,
    taxAmount,
    platformFeeRate,
    platformFee,
    landedCost,
    totalCharge,
    currency,
    quotedAt,
    expiresAt: new Date(quotedAt.getTime() + ttlMs),
  };
}

export function isQuoteExpired(quote: QuoteBreakdown, now: Date = new Date()): boolean {
  return now.getTime() > quote.expiresAt.getTime();
}

export { money };
