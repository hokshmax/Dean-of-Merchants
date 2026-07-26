import { describe, expect, it } from "vitest";
import type {
  AdapterHealthStatus,
  Address,
  CheckoutInput,
  CheckoutResult,
  ProductQuery,
  RetailerOfferResult,
  SearchOptions,
  ShippingTaxEstimate,
} from "@dean/shared-types";
import { AdapterRegistry } from "./registry";
import type { RetailerAdapter } from "./types";

function makeAdapter(overrides: Partial<RetailerAdapter> & { id: string }): RetailerAdapter {
  return {
    displayName: overrides.id,
    supportedRegions: ["US"],
    capabilities: { canAutoCheckout: false },
    search: async () => [],
    estimateShippingAndTax: async (): Promise<ShippingTaxEstimate> => ({
      shippingCost: { amountMinorUnits: 0, currency: "USD" },
      taxAmount: { amountMinorUnits: 0, currency: "USD" },
    }),
    checkout: async (): Promise<CheckoutResult> => ({ success: false }),
    healthCheck: async (): Promise<AdapterHealthStatus> => ({
      retailerId: overrides.id,
      status: "healthy",
      rollingFailureRate: 0,
    }),
    ...overrides,
  };
}

const query: ProductQuery = {
  rawQuery: "wireless mouse",
  currency: "USD",
  destinationCountryCode: "US",
  condition: "any",
};

const opts: SearchOptions = { timeoutMs: 100, maxResults: 5 };

function offer(retailerId: string): RetailerOfferResult {
  return {
    retailerId,
    retailerName: retailerId,
    offerId: `${retailerId}-1`,
    title: "Wireless Mouse",
    url: `https://example.com/${retailerId}`,
    price: { amountMinorUnits: 1999, currency: "USD" },
    availability: "in_stock",
    scrapedAt: new Date(),
  };
}

describe("AdapterRegistry", () => {
  it("prevents registering the same retailer id twice", () => {
    const registry = new AdapterRegistry();
    registry.register(makeAdapter({ id: "ebay" }));
    expect(() => registry.register(makeAdapter({ id: "ebay" }))).toThrow(/already registered/);
  });

  it("fans a search out across every registered adapter and merges results", async () => {
    const registry = new AdapterRegistry();
    registry.register(makeAdapter({ id: "ebay", search: async () => [offer("ebay")] }));
    registry.register(makeAdapter({ id: "amazon", search: async () => [offer("amazon")] }));

    const result = await registry.searchAll(query, opts);

    expect(result.offers.map((o) => o.retailerId).sort()).toEqual(["amazon", "ebay"]);
    expect(result.failures).toEqual([]);
  });

  it("isolates a failing adapter so the rest still return results", async () => {
    const registry = new AdapterRegistry();
    registry.register(
      makeAdapter({
        id: "broken",
        search: async () => {
          throw new Error("selector changed");
        },
      }),
    );
    registry.register(makeAdapter({ id: "ebay", search: async () => [offer("ebay")] }));

    const result = await registry.searchAll(query, opts);

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].retailerId).toBe("ebay");
    expect(result.failures).toEqual([{ retailerId: "broken", reason: "selector changed" }]);
  });

  it("treats a hung adapter as a failure once its timeout elapses", async () => {
    const registry = new AdapterRegistry();
    registry.register(
      makeAdapter({
        id: "slow",
        search: () => new Promise((resolve) => setTimeout(() => resolve([offer("slow")]), 500)),
      }),
    );

    const result = await registry.searchAll(query, { timeoutMs: 20, maxResults: 5 });

    expect(result.offers).toEqual([]);
    expect(result.failures[0].retailerId).toBe("slow");
    expect(result.failures[0].reason).toMatch(/timed out/);
  });
});
