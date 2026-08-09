import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";

const logger = createLogger("retailer-adapters:walmart");

/**
 * Walmart has no public product-search API for third parties -- catalog access requires
 * approval into Walmart Creator (Walmart's affiliate program, run via Impact.com). Scraping
 * was confirmed blocked by a "Robot or human? Press & Hold" challenge even from a residential
 * IP, so this stays a stub (no attempt, no wasted timeout) until WALMART_AFFILIATE_API_KEY is
 * set with real Walmart Creator credentials and the API integration is written against them.
 */
export async function searchWalmart(
  _query: ProductQuery,
  _opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  if (!process.env.WALMART_AFFILIATE_API_KEY) {
    logger.warn(
      "Walmart adapter not configured -- apply to Walmart Creator (Impact.com) and set WALMART_AFFILIATE_API_KEY to enable it",
    );
  }
  return [];
}
