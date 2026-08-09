import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";

const logger = createLogger("retailer-adapters:noon");

/**
 * noon runs its affiliate program through a third-party network (commonly Admitad in the
 * MENA region) rather than a first-party API -- needs an approved affiliate account before any
 * real integration can be written against it. Scraping was confirmed blocked even from a
 * residential IP, so this stays a stub until NOON_AFFILIATE_API_KEY is set with real network
 * credentials.
 */
export async function searchNoon(
  _query: ProductQuery,
  _opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  if (!process.env.NOON_AFFILIATE_API_KEY) {
    logger.warn(
      "noon adapter not configured -- apply to noon's affiliate program and set NOON_AFFILIATE_API_KEY to enable it",
    );
  }
  return [];
}
