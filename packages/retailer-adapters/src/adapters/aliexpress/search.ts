import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";

const logger = createLogger("retailer-adapters:aliexpress");

/**
 * AliExpress does run its own official Affiliate Program (affiliates.aliexpress.com, "Portals")
 * with a product-search + link-generation API, but it needs an approved affiliate account and
 * an app_key/app_secret pair, and its request-signing scheme should be verified against current
 * docs once real credentials exist rather than guessed here. Scraping was confirmed blocked by
 * a slider CAPTCHA even from a residential IP, so this stays a stub until
 * ALIEXPRESS_AFFILIATE_APP_KEY is set and the signed-request integration is built against real
 * credentials.
 */
export async function searchAliExpress(
  _query: ProductQuery,
  _opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  if (!process.env.ALIEXPRESS_AFFILIATE_APP_KEY) {
    logger.warn(
      "AliExpress adapter not configured -- apply to the AliExpress Affiliate Program and set ALIEXPRESS_AFFILIATE_APP_KEY to enable it",
    );
  }
  return [];
}
