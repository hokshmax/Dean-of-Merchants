import { describe, expect, it } from "vitest";
import type { RetailerOfferResult, ShippingTaxEstimate } from "@dean/shared-types";
import { buildQuoteBreakdown, isQuoteExpired } from "./quote";
import { addMoney, money, multiplyMoney, sumMoney } from "./money";

function makeOffer(priceMinorUnits: number): RetailerOfferResult {
  return {
    retailerId: "ebay-us",
    retailerName: "eBay",
    offerId: "offer-1",
    title: "Test Product",
    url: "https://example.com/product",
    price: money(priceMinorUnits, "USD"),
    availability: "in_stock",
    scrapedAt: new Date("2026-07-26T00:00:00Z"),
  };
}

function makeEstimate(shippingMinorUnits: number, taxMinorUnits: number): ShippingTaxEstimate {
  return {
    shippingCost: money(shippingMinorUnits, "USD"),
    taxAmount: money(taxMinorUnits, "USD"),
    estimatedDeliveryDays: 5,
  };
}

describe("money", () => {
  it("adds amounts of the same currency", () => {
    expect(addMoney(money(100, "USD"), money(250, "USD"))).toEqual(money(350, "USD"));
  });

  it("throws on currency mismatch", () => {
    expect(() => addMoney(money(100, "USD"), money(100, "EUR"))).toThrow(/Currency mismatch/);
  });

  it("multiplies and rounds to the nearest minor unit", () => {
    // 2.5% of $19.99 (1999 cents) = 49.975 -> rounds to 50 cents
    expect(multiplyMoney(money(1999, "USD"), 0.025)).toEqual(money(50, "USD"));
  });

  it("sums a list of money values", () => {
    expect(sumMoney([money(100, "USD"), money(200, "USD"), money(300, "USD")], "USD")).toEqual(
      money(600, "USD"),
    );
  });
});

describe("buildQuoteBreakdown", () => {
  it("computes the fee on product price only, excluding shipping and tax", () => {
    // Product $100.00 (10000), shipping $12.50 (1250), tax $8.00 (800)
    const quote = buildQuoteBreakdown({
      offer: makeOffer(10_000),
      estimate: makeEstimate(1_250, 800),
    });

    expect(quote.productPrice).toEqual(money(10_000, "USD"));
    expect(quote.shippingCost).toEqual(money(1_250, "USD"));
    expect(quote.taxAmount).toEqual(money(800, "USD"));
    // 2.5% of $100.00 = $2.50 (250 cents) -- NOT 2.5% of the $120.50 landed cost
    expect(quote.platformFee).toEqual(money(250, "USD"));
    expect(quote.landedCost).toEqual(money(12_050, "USD"));
    expect(quote.totalCharge).toEqual(money(12_300, "USD"));
  });

  it("supports a custom platform fee rate", () => {
    const quote = buildQuoteBreakdown({
      offer: makeOffer(20_000),
      estimate: makeEstimate(0, 0),
      platformFeeRate: 0.05,
    });
    expect(quote.platformFee).toEqual(money(1_000, "USD"));
    expect(quote.totalCharge).toEqual(money(21_000, "USD"));
  });

  it("throws when offer, shipping, and tax currencies disagree", () => {
    const offer = makeOffer(10_000);
    const estimate: ShippingTaxEstimate = {
      shippingCost: money(500, "EUR"),
      taxAmount: money(0, "USD"),
    };
    expect(() => buildQuoteBreakdown({ offer, estimate })).toThrow(/Currency mismatch/);
  });

  it("sets an expiry in the future relative to quotedAt", () => {
    const quotedAt = new Date("2026-07-26T12:00:00Z");
    const quote = buildQuoteBreakdown({
      offer: makeOffer(5_000),
      estimate: makeEstimate(500, 200),
      quotedAt,
      ttlMs: 60_000,
    });
    expect(quote.expiresAt.getTime() - quotedAt.getTime()).toBe(60_000);
    expect(isQuoteExpired(quote, new Date("2026-07-26T12:00:30Z"))).toBe(false);
    expect(isQuoteExpired(quote, new Date("2026-07-26T12:02:00Z"))).toBe(true);
  });
});
