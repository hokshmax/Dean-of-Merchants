import type { Money } from "@dean/shared-types";

export function formatMoney(amount: Money): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: amount.currency,
  }).format(amount.amountMinorUnits / 100);
}
