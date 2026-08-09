import type { Address, PrintfulVariant } from "@dean/shared-types";
import { createLogger } from "@dean/logger";

const logger = createLogger("pod-fulfillment:printful");

const API_BASE = "https://api.printful.com";

// Bella + Canvas 3001 Unisex Staple T-Shirt has been Printful's standard example product across
// its own docs and tutorials for years, but catalog product IDs are Printful's to change --
// kept as a default rather than hardcoded assumption, overridable via env so it's easy to
// verify/correct against a real account rather than trusting a guess.
const DEFAULT_TSHIRT_PRODUCT_ID = 71;

interface PrintfulApiResponse<T> {
  code: number;
  result: T;
  error?: { message: string };
}

interface PrintfulCatalogVariant {
  id: number;
  name: string;
  size: string;
  color: string;
  price: string;
}

interface PrintfulCatalogProductResult {
  variants: PrintfulCatalogVariant[];
}

interface PrintfulOrderRecipient {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code?: string;
  country_code: string;
  zip: string;
  email: string;
}

interface PrintfulOrderItem {
  variant_id: number;
  quantity: number;
  files: { url: string }[];
}

interface PrintfulOrderResult {
  id: number;
  status: string;
}

export interface CreatePrintfulOrderInput {
  variantId: number;
  quantity: number;
  designImageUrl: string;
  recipient: Address;
  recipientEmail: string;
}

export interface PrintfulOrder {
  printfulOrderId: string;
  status: string;
}

export interface PrintfulClient {
  listTShirtVariants(): Promise<PrintfulVariant[]>;
  createOrder(input: CreatePrintfulOrderInput): Promise<PrintfulOrder>;
  getOrderStatus(printfulOrderId: string): Promise<PrintfulOrder>;
}

/**
 * Thin wrapper over Printful's classic v1 REST API (api.printful.com) -- the long-stable,
 * widely-documented "manual order / API store" flow, not the newer v2 beta API whose exact
 * request/response shapes weren't confirmed against real docs. Requires a private API token
 * (PRINTFUL_API_KEY) from a Printful account's Settings > Stores > API section.
 */
export function createPrintfulClient(apiKey: string, tshirtProductId: number = DEFAULT_TSHIRT_PRODUCT_ID): PrintfulClient {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    const body = (await response.json()) as PrintfulApiResponse<T>;
    if (!response.ok || body.code >= 300) {
      logger.error({ path, status: response.status, error: body.error }, "Printful API request failed");
      throw new Error(`Printful API request to ${path} failed: ${body.error?.message ?? response.statusText}`);
    }
    return body.result;
  }

  return {
    async listTShirtVariants(): Promise<PrintfulVariant[]> {
      const result = await request<PrintfulCatalogProductResult>(`/products/${tshirtProductId}`);
      return result.variants.map((variant) => ({
        variantId: variant.id,
        productName: variant.name,
        size: variant.size,
        color: variant.color,
        baseCost: { amountMinorUnits: Math.round(parseFloat(variant.price) * 100), currency: "USD" },
      }));
    },

    async createOrder(input: CreatePrintfulOrderInput): Promise<PrintfulOrder> {
      const recipient: PrintfulOrderRecipient = {
        name: input.recipient.name,
        address1: input.recipient.line1,
        address2: input.recipient.line2,
        city: input.recipient.city,
        state_code: input.recipient.region,
        country_code: input.recipient.countryCode,
        zip: input.recipient.postalCode,
        email: input.recipientEmail,
      };
      const items: PrintfulOrderItem[] = [
        {
          variant_id: input.variantId,
          quantity: input.quantity,
          files: [{ url: input.designImageUrl }],
        },
      ];

      const result = await request<PrintfulOrderResult>("/orders", {
        method: "POST",
        body: JSON.stringify({ recipient, items }),
      });

      return { printfulOrderId: String(result.id), status: result.status };
    },

    async getOrderStatus(printfulOrderId: string): Promise<PrintfulOrder> {
      const result = await request<PrintfulOrderResult>(`/orders/${printfulOrderId}`);
      return { printfulOrderId: String(result.id), status: result.status };
    },
  };
}
