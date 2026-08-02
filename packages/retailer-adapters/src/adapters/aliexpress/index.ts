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
import { AdapterNotImplementedError, type RetailerAdapter } from "../../types";
import { estimateFlatShippingAndTax } from "../../heuristics/shipping-tax";
import { searchAliExpress } from "./search";

const FLAT_SHIPPING_MINOR_UNITS = 399; // $3.99 -- placeholder; real AliExpress shipping varies widely by seller

export const aliexpressAdapter: RetailerAdapter = {
  id: "aliexpress",
  displayName: "AliExpress",
  supportedRegions: ["US", "GB", "CA", "AU", "DE", "FR"],
  capabilities: { canAutoCheckout: false },

  async search(query: ProductQuery, opts: SearchOptions): Promise<RetailerOfferResult[]> {
    return searchAliExpress(query, opts);
  },

  async estimateShippingAndTax(
    offer: RetailerOfferResult,
    destination: Address,
  ): Promise<ShippingTaxEstimate> {
    return estimateFlatShippingAndTax(offer.price, destination.countryCode, FLAT_SHIPPING_MINOR_UNITS);
  },

  async checkout(_input: CheckoutInput): Promise<CheckoutResult> {
    throw new AdapterNotImplementedError(this.id, "checkout");
  },

  async healthCheck(): Promise<AdapterHealthStatus> {
    return {
      retailerId: this.id,
      status: "healthy",
      rollingFailureRate: 0,
    };
  },
};
