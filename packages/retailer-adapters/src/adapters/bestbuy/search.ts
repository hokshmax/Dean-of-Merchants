import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";

const logger = createLogger("retailer-adapters:bestbuy");

const RETAILER_ID = "bestbuy";
const RETAILER_NAME = "Best Buy";

interface BestBuyProduct {
  sku: number;
  name: string;
  salePrice?: number;
  url: string;
  image?: string;
  onlineAvailability?: boolean;
}

interface BestBuyProductsResponse {
  products?: BestBuyProduct[];
}

/**
 * Uses Best Buy's official Products API instead of scraping the search-results page --
 * scraping was blocked the same way every other retailer here was. Requires a free Best Buy
 * developer API key (BESTBUY_API_KEY, https://developer.bestbuy.com); returns no results when
 * unset rather than attempting an unauthenticated call.
 *
 * BESTBUY_AFFILIATE_LINK_TEMPLATE (optional) wraps returned product URLs for commission
 * attribution once an Impact.com affiliate link format is available -- Best Buy's affiliate
 * program is run through Impact.com rather than a simple static query-param format, so this is
 * left as a user-supplied template (`{URL}` gets replaced with the real product URL) rather
 * than a guessed/hardcoded link shape.
 */
export async function searchBestBuy(
  query: ProductQuery,
  opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  const apiKey = process.env.BESTBUY_API_KEY;
  if (!apiKey) {
    logger.warn("Best Buy adapter not configured -- set BESTBUY_API_KEY to enable it");
    return [];
  }

  const searchExpr = `(search=${encodeURIComponent(query.rawQuery)})`;
  const url = new URL(`https://api.bestbuy.com/v1/products${searchExpr}`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("show", "sku,name,salePrice,url,image,onlineAvailability");
  url.searchParams.set("pageSize", String(opts.maxResults));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.warn({ status: response.status, body }, "Best Buy Products API request failed");
      return [];
    }

    const data = (await response.json()) as BestBuyProductsResponse;
    return (data.products ?? [])
      .map((product) => parseOffer(product))
      .filter((offer): offer is RetailerOfferResult => offer !== null);
  } finally {
    clearTimeout(timeout);
  }
}

function parseOffer(product: BestBuyProduct): RetailerOfferResult | null {
  if (typeof product.salePrice !== "number") return null;

  const amountMinorUnits = Math.round(product.salePrice * 100);
  const offerId = `${RETAILER_ID}:${product.sku}`;

  return {
    retailerId: RETAILER_ID,
    retailerName: RETAILER_NAME,
    offerId,
    title: product.name,
    url: applyAffiliateTemplate(product.url),
    imageUrl: product.image,
    price: { amountMinorUnits, currency: "USD" },
    availability: product.onlineAvailability === false ? "out_of_stock" : "in_stock",
    scrapedAt: new Date(),
  };
}

function applyAffiliateTemplate(productUrl: string): string {
  const template = process.env.BESTBUY_AFFILIATE_LINK_TEMPLATE;
  if (!template) return productUrl;
  return template.replace("{URL}", encodeURIComponent(productUrl));
}
