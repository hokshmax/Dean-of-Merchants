import { describe, expect, it } from "vitest";
import { searchProductsInputSchema } from "./search-products";

describe("searchProductsInputSchema", () => {
  it("accepts a minimal valid query", () => {
    const parsed = searchProductsInputSchema.parse({ rawQuery: "logitech mx master 3s" });
    expect(parsed.rawQuery).toBe("logitech mx master 3s");
    expect(parsed.condition).toBe("any");
  });

  it("rejects a query missing rawQuery", () => {
    expect(() => searchProductsInputSchema.parse({})).toThrow();
  });

  it("does not accept a destinationCountryCode field even if the model sends one", () => {
    const parsed = searchProductsInputSchema.parse({
      rawQuery: "wireless mouse",
      destinationCountryCode: "US",
    } as unknown as Record<string, unknown>);
    expect(parsed).not.toHaveProperty("destinationCountryCode");
  });
});
