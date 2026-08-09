import { describe, expect, it } from "vitest";
import { money } from "./money";
import { calculateRetailPrice } from "./retail-price";

describe("calculateRetailPrice", () => {
  it("applies the default 50% margin on top of Printful's base cost", () => {
    const result = calculateRetailPrice({ baseCost: money(1_500, "USD") });
    expect(result.margin).toEqual(money(750, "USD"));
    expect(result.retailPrice).toEqual(money(2_250, "USD"));
  });

  it("supports a custom margin rate", () => {
    const result = calculateRetailPrice({ baseCost: money(2_000, "USD"), marginRate: 0.25 });
    expect(result.margin).toEqual(money(500, "USD"));
    expect(result.retailPrice).toEqual(money(2_500, "USD"));
  });
});
