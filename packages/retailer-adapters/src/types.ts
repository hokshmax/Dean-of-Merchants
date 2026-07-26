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

/**
 * Every retailer integration implements this interface and nothing else in the system
 * depends on retailer-specific code. Adding, removing, or fixing a retailer means touching
 * only its own adapter module and the registry registration -- never chat orchestration,
 * pricing, or order logic.
 */
export interface RetailerAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly supportedRegions: string[];
  readonly capabilities: {
    canAutoCheckout: boolean;
  };

  search(query: ProductQuery, opts: SearchOptions): Promise<RetailerOfferResult[]>;
  estimateShippingAndTax(
    offer: RetailerOfferResult,
    destination: Address,
  ): Promise<ShippingTaxEstimate>;
  /** Phase 3: automated checkout. Phase 1 adapters may throw "not implemented". */
  checkout(input: CheckoutInput): Promise<CheckoutResult>;
  healthCheck(): Promise<AdapterHealthStatus>;
}

export class AdapterNotImplementedError extends Error {
  constructor(retailerId: string, capability: string) {
    super(`Retailer adapter "${retailerId}" does not implement "${capability}" yet`);
    this.name = "AdapterNotImplementedError";
  }
}
