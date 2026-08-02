import { getSharedBrowserPool } from "@dean/scraping-kernel";
import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";
import { parsePriceToMinorUnits } from "../../heuristics/price-parsing";

const logger = createLogger("retailer-adapters:walmart");

const RETAILER_ID = "walmart";
const RETAILER_NAME = "Walmart";

/**
 * Scrapes Walmart's search results page using its `data-automation-id` attributes, which are
 * more stable than class names but still not guaranteed -- like the other adapters, this needs
 * live verification and will need selector maintenance as Walmart's markup changes. Walmart
 * also runs meaningful anti-bot detection, so expect occasional CAPTCHA/empty-result runs.
 */
export async function searchWalmart(
  query: ProductQuery,
  opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  const pool = getSharedBrowserPool();
  const context = await pool.acquireContext({ adapterId: RETAILER_ID });
  const page = await context.newPage();

  try {
    const searchUrl = `https://www.walmart.com/search?q=${encodeURIComponent(query.rawQuery)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs });
    await page.waitForSelector("[data-item-id]", { timeout: opts.timeoutMs }).catch(() => {
      logger.warn({ searchUrl }, "Walmart search: no results found, page markup may have changed");
    });

    const items = await page.$$eval(
      "[data-item-id]",
      (nodes, maxResults) =>
        nodes
          .slice(0, maxResults)
          .map((node) => {
            const titleEl = node.querySelector('[data-automation-id="product-title"]');
            const priceEl = node.querySelector('[data-automation-id="product-price"]');
            const linkEl = node.querySelector<HTMLAnchorElement>("a");
            const imgEl = node.querySelector<HTMLImageElement>("img");
            return {
              title: titleEl?.textContent?.trim() ?? "",
              priceText: priceEl?.textContent?.trim() ?? "",
              url: linkEl?.href ?? "",
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
  const amountMinorUnits = parsePriceToMinorUnits(item.priceText);
  if (amountMinorUnits === null) return null;

  const offerId = `${RETAILER_ID}:${Buffer.from(item.url).toString("base64url").slice(0, 24)}`;

  return {
    retailerId: RETAILER_ID,
    retailerName: RETAILER_NAME,
    offerId,
    title: item.title,
    url: item.url,
    imageUrl: item.imageUrl,
    price: { amountMinorUnits, currency: "USD" },
    availability: "in_stock",
    scrapedAt: new Date(),
  };
}
