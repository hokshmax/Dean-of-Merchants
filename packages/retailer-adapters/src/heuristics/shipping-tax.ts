import type { Money, ShippingTaxEstimate } from "@dean/shared-types";

/**
 * Placeholder sales-tax-by-destination table. This is a rough US-centric heuristic to make
 * Phase 1 quotes directionally correct; it is NOT a real tax engine. Replace with a proper
 * tax/duty provider (e.g. TaxJar, or customs-duty tables for cross-border) before any real
 * money moves in Phase 2+.
 */
const FLAT_TAX_RATE_BY_COUNTRY: Record<string, number> = {
  US: 0.07,
  GB: 0.2,
  CA: 0.13,
  AU: 0.1,
  DE: 0.19,
};

export function estimateFlatShippingAndTax(
  productPrice: Money,
  destinationCountryCode: string,
  flatShippingMinorUnits: number,
): ShippingTaxEstimate {
  const taxRate = FLAT_TAX_RATE_BY_COUNTRY[destinationCountryCode] ?? 0.05;
  const taxAmountMinorUnits = Math.round(productPrice.amountMinorUnits * taxRate);

  return {
    shippingCost: { amountMinorUnits: flatShippingMinorUnits, currency: productPrice.currency },
    taxAmount: { amountMinorUnits: taxAmountMinorUnits, currency: productPrice.currency },
    estimatedDeliveryDays: 7,
  };
}
