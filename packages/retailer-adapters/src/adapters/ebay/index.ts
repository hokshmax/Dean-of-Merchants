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
import { searchEbay } from "./search";

const FLAT_SHIPPING_MINOR_UNITS = 599; // $5.99 -- placeholder until real carrier-rate lookup

export const ebayAdapter: RetailerAdapter = {
  id: "ebay",
  displayName: "eBay",
  supportedRegions: ["US", "GB", "CA", "AU", "DE"],
  capabilities: { canAutoCheckout: false },

  async search(query: ProductQuery, opts: SearchOptions): Promise<RetailerOfferResult[]> {
    return searchEbay(query, opts);
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
