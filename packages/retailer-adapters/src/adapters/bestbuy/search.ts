import { getSharedBrowserPool } from "@dean/scraping-kernel";
import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";
import { parsePriceToMinorUnits } from "../../heuristics/price-parsing";

const logger = createLogger("retailer-adapters:bestbuy");

const RETAILER_ID = "bestbuy";
const RETAILER_NAME = "Best Buy";

/**
 * Scrapes Best Buy's search results page. `.sku-item` has historically been Best Buy's stable
 * search-result-card class, but like every adapter here this is unverified against a live run.
 */
export async function searchBestBuy(
  query: ProductQuery,
  opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  const pool = getSharedBrowserPool();
  const context = await pool.acquireContext({ adapterId: RETAILER_ID });
  const page = await context.newPage();

  try {
    const searchUrl = `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(query.rawQuery)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs });
    await page.waitForSelector(".sku-item", { timeout: opts.timeoutMs }).catch(() => {
      logger.warn({ searchUrl }, "Best Buy search: no .sku-item results found, page markup may have changed");
    });

    const items = await page.$$eval(
      ".sku-item",
      (nodes, maxResults) =>
        nodes
          .slice(0, maxResults)
          .map((node) => {
            const titleEl = node.querySelector(".sku-title a");
            const priceEl = node.querySelector(".priceView-hero-price span, .priceView-customer-price span");
            const imgEl = node.querySelector<HTMLImageElement>("img");
            return {
              title: titleEl?.textContent?.trim() ?? "",
              priceText: priceEl?.textContent?.trim() ?? "",
              url: (titleEl as HTMLAnchorElement | null)?.href ?? "",
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
