import { getSharedBrowserPool } from "@dean/scraping-kernel";
import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";

const logger = createLogger("retailer-adapters:noon");

const RETAILER_ID = "noon";
const RETAILER_NAME = "noon";

/**
 * Scrapes noon's UAE storefront search results, using its `data-qa` test-hook attributes.
 * Unverified against a live run, same caveat as every adapter here. Prices are in AED (UAE
 * Dirham), not USD -- this adapter reports its native currency rather than converting, so the
 * pricing engine's currency-match check will reject mixing it into a USD-destination quote
 * until real currency conversion exists (a Phase 2+ concern, not something faked here).
 */
export async function searchNoon(
  query: ProductQuery,
  opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  const pool = getSharedBrowserPool();
  const context = await pool.acquireContext({ adapterId: RETAILER_ID });
  const page = await context.newPage();

  try {
    const searchUrl = `https://www.noon.com/uae-en/search/?q=${encodeURIComponent(query.rawQuery)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs });
    await page.waitForSelector('[data-qa="plp-product-box"]', { timeout: opts.timeoutMs }).catch(() => {
      logger.warn({ searchUrl }, "noon search: no results found, page markup may have changed");
    });

    const items = await page.$$eval(
      '[data-qa="plp-product-box"]',
      (nodes, maxResults) =>
        nodes
          .slice(0, maxResults)
          .map((node) => {
            const anchor = node.closest("a") ?? node.querySelector<HTMLAnchorElement>("a");
            const titleEl = node.querySelector('[data-qa="product-name"]');
            const priceEl = node.querySelector('[data-qa="offer-price"], .priceNow');
            const imgEl = node.querySelector<HTMLImageElement>("img");
            return {
              title: titleEl?.textContent?.trim() ?? "",
              priceText: priceEl?.textContent?.trim() ?? "",
              url: (anchor as HTMLAnchorElement | null)?.href ?? "",
              imageUrl: imgEl?.src,
            };
          })
          .filter((item) => item.title && item.url && item.priceText),
      opts.maxResults,
    );

    return items
      .map((item) => parseOffer(item))
      .filter((offer): offer is RetailerOfferResult => offer !== null);
  } finally {
    await page.close();
    await pool.releaseContext(context);
  }
}

function parseOffer(item: {
  title: string;
  priceText: string;
  url: string;
  imageUrl?: string;
}): RetailerOfferResult | null {
  // noon renders prices like "AED 79.00" or "79.00" -- strip any letters, keep the number.
  const match = item.priceText.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const amountMinorUnits = Math.round(parseFloat(match[1]) * 100);

  const offerId = `${RETAILER_ID}:${Buffer.from(item.url).toString("base64url").slice(0, 24)}`;

  return {
    retailerId: RETAILER_ID,
    retailerName: RETAILER_NAME,
    offerId,
    title: item.title,
    url: item.url,
    imageUrl: item.imageUrl,
    price: { amountMinorUnits, currency: "AED" },
    availability: "in_stock",
    scrapedAt: new Date(),
  };
}
