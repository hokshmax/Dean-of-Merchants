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
import { searchNoon } from "./search";

const FLAT_SHIPPING_MINOR_UNITS = 1500; // AED 15.00 -- placeholder flat estimate

export const noonAdapter: RetailerAdapter = {
  id: "noon",
  displayName: "noon",
  // noon serves the Gulf/MENA region, not the US -- deliberately NOT including "US" here.
  // No other registered adapter currently lists AE/SA/EG, so this never mixes AED offers
  // into a USD-sorted result list; that would need real currency conversion first.
  supportedRegions: ["AE", "SA", "EG"],
  capabilities: { canAutoCheckout: false },

  async search(query: ProductQuery, opts: SearchOptions): Promise<RetailerOfferResult[]> {
    return searchNoon(query, opts);
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
