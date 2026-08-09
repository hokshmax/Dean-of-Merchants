import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";

const logger = createLogger("retailer-adapters:amazon");

/**
 * Amazon's Product Advertising API requires an approved Amazon Associates account that keeps
 * generating a minimum number of qualifying affiliate sales every 30 days to stay active --
 * a chicken-and-egg problem for a new app with no existing traffic, and the API itself is
 * being deprecated May 15, 2026 in favor of a Creators API aimed at content creators, not
 * general shopping-search apps. Scraping was never attempted for Amazon in production (it was
 * always the deliberately "hard" adapter in this codebase); it stays a stub until an
 * AMAZON_ASSOCIATES_TAG is available and a real Associates account can sustain API access.
 */
export async function searchAmazon(
  _query: ProductQuery,
  _opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  if (!process.env.AMAZON_ASSOCIATES_TAG) {
    logger.warn(
      "Amazon adapter not configured -- requires an active Amazon Associates account; set AMAZON_ASSOCIATES_TAG to enable it",
    );
  }
  return [];
}
