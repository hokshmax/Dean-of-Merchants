import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";

const logger = createLogger("retailer-adapters:target");

/**
 * Target has no public product-search API for third parties -- catalog access requires
 * approval into the Target Affiliate Program (run via Impact.com). Scraping was confirmed
 * blocked (page stuck behind a bot-detection loading overlay) even from a residential IP, so
 * this stays a stub until TARGET_AFFILIATE_API_KEY is set with real Impact.com credentials and
 * the API integration is written against them.
 */
export async function searchTarget(
  _query: ProductQuery,
  _opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  if (!process.env.TARGET_AFFILIATE_API_KEY) {
    logger.warn(
      "Target adapter not configured -- apply to the Target Affiliate Program (Impact.com) and set TARGET_AFFILIATE_API_KEY to enable it",
    );
  }
  return [];
}
