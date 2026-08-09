import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";

const logger = createLogger("retailer-adapters:temu");

/**
 * Temu runs its own affiliate/creator program but has no public product-search API for third
 * parties -- needs an approved affiliate account before any real integration can be written.
 * Scraping was confirmed blocked (redirected straight to a forced login/signup wall before any
 * search results) even from a residential IP, so this stays a stub until TEMU_AFFILIATE_API_KEY
 * is set with real program credentials.
 */
export async function searchTemu(
  _query: ProductQuery,
  _opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  if (!process.env.TEMU_AFFILIATE_API_KEY) {
    logger.warn(
      "Temu adapter not configured -- apply to Temu's affiliate program and set TEMU_AFFILIATE_API_KEY to enable it",
    );
  }
  return [];
}
