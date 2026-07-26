import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { OfferQuote } from "@dean/shared-types";

export const SEARCH_PRODUCTS_TOOL_NAME = "search_products";

/**
 * Claude is only ever allowed to emit a structured search query -- never a purchase
 * instruction. destinationCountryCode/currency intentionally are NOT part of this schema:
 * they come from the user's account/session, not from anything Claude infers from chat, so a
 * model mistake can't silently ship an order to (or price it in) the wrong country.
 */
export const searchProductsInputSchema = z.object({
  rawQuery: z.string().min(1).describe("The user's product request in natural language"),
  brand: z.string().optional(),
  model: z.string().optional(),
  attributes: z
    .record(z.string(), z.string())
    .optional()
    .describe("Distinguishing attributes, e.g. { color: 'black', storage: '256GB' }"),
  budgetMaxMinorUnits: z
    .number()
    .int()
    .optional()
    .describe("User's stated maximum budget, in minor currency units (cents), if given"),
  condition: z.enum(["new", "used", "any"]).default("any"),
});
export type SearchProductsInput = z.infer<typeof searchProductsInputSchema>;

export const searchProductsTool: Anthropic.Tool = {
  name: SEARCH_PRODUCTS_TOOL_NAME,
  description:
    "Search local and global retailers for priced offers matching a product request. " +
    "Returns ranked offers with full landed-cost breakdowns (product price, shipping, tax, " +
    "and platform fee). Does not purchase anything.",
  input_schema: {
    type: "object",
    properties: {
      rawQuery: { type: "string", description: "The user's product request in natural language" },
      brand: { type: "string" },
      model: { type: "string" },
      attributes: {
        type: "object",
        additionalProperties: { type: "string" },
        description: "Distinguishing attributes, e.g. { color: 'black', storage: '256GB' }",
      },
      budgetMaxMinorUnits: {
        type: "integer",
        description: "User's stated maximum budget, in minor currency units (cents), if given",
      },
      condition: { type: "string", enum: ["new", "used", "any"] },
    },
    required: ["rawQuery"],
  },
};

export interface SearchProductsToolResult {
  offers: OfferQuote[];
  failedRetailers: string[];
}
