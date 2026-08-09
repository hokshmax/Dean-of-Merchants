import type { Money } from "@dean/shared-types";
import { addMoney, multiplyMoney } from "./money";

export const DEFAULT_MARGIN_RATE = 0.5;

export interface RetailPriceInput {
  /** In-house cost to print, produce, and ship this item. */
  baseCost: Money;
  marginRate?: number;
}

export interface RetailPriceBreakdown {
  baseCost: Money;
  marginRate: number;
  margin: Money;
  retailPrice: Money;
}

/**
 * Eldorado's margin is charged on the real in-house production cost, the same "fee on the real
 * cost, not on some inflated number" principle the old landed-cost quote enforced for retailer
 * offers.
 */
export function calculateRetailPrice(input: RetailPriceInput): RetailPriceBreakdown {
  const { baseCost, marginRate = DEFAULT_MARGIN_RATE } = input;
  const margin = multiplyMoney(baseCost, marginRate);
  const retailPrice = addMoney(baseCost, margin);
  return { baseCost, marginRate, margin, retailPrice };
}
