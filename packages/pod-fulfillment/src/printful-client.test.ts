import { afterEach, describe, expect, it, vi } from "vitest";
import { createPrintfulClient } from "./printful-client";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe("createPrintfulClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps catalog variants, converting decimal price strings to integer minor units", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 200,
        result: {
          variants: [{ id: 4012, name: "Bella Canvas 3001", size: "M", color: "Black", price: "12.95" }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createPrintfulClient("test-key", 71);
    const variants = await client.listTShirtVariants();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.printful.com/products/71",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-key" }) }),
    );
    expect(variants).toEqual([
      {
        variantId: 4012,
        productName: "Bella Canvas 3001",
        size: "M",
        color: "Black",
        baseCost: { amountMinorUnits: 1295, currency: "USD" },
      },
    ]);
  });

  it("maps a recipient address to Printful's snake_case order shape when creating an order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ code: 200, result: { id: 555, status: "draft" } }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createPrintfulClient("test-key", 71);
    const result = await client.createOrder({
      variantId: 4012,
      quantity: 2,
      designImageUrl: "https://example.com/design.png",
      recipient: {
        name: "Ada Lovelace",
        line1: "123 Main St",
        city: "London",
        postalCode: "SW1A 1AA",
        countryCode: "GB",
      },
      recipientEmail: "ada@example.com",
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      recipient: {
        name: "Ada Lovelace",
        address1: "123 Main St",
        address2: undefined,
        city: "London",
        state_code: undefined,
        country_code: "GB",
        zip: "SW1A 1AA",
        email: "ada@example.com",
      },
      items: [{ variant_id: 4012, quantity: 2, files: [{ url: "https://example.com/design.png" }] }],
    });
    expect(result).toEqual({ printfulOrderId: "555", status: "draft" });
  });

  it("throws with the API's error message when a request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 404, error: { message: "not found" } }, false, 404));
    vi.stubGlobal("fetch", fetchMock);

    const client = createPrintfulClient("test-key", 71);
    await expect(client.getOrderStatus("999")).rejects.toThrow("not found");
  });
});
