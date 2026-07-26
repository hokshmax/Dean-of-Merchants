import type { Money } from "@dean/shared-types";

export function money(amountMinorUnits: number, currency: string): Money {
  if (!Number.isInteger(amountMinorUnits)) {
    throw new Error(`Money amounts must be integer minor units, got ${amountMinorUnits}`);
  }
  return { amountMinorUnits, currency: currency.toUpperCase() };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinorUnits + b.amountMinorUnits, a.currency);
}

export function sumMoney(items: Money[], currency: string): Money {
  return items.reduce((acc, item) => addMoney(acc, item), money(0, currency));
}

/** Multiplies a Money amount by a decimal rate, rounding to the nearest minor unit. */
export function multiplyMoney(amount: Money, rate: number): Money {
  return money(Math.round(amount.amountMinorUnits * rate), amount.currency);
}

export function isZero(amount: Money): boolean {
  return amount.amountMinorUnits === 0;
}
