import { captureDebugArtifact, getSharedBrowserPool } from "@dean/scraping-kernel";
import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";

const logger = createLogger("retailer-adapters:ebay");

const RETAILER_ID = "ebay";
const RETAILER_NAME = "eBay";

/**
 * Scrapes eBay's public search results page. Selectors below match eBay's search-results
 * markup as of late 2025/2026 and WILL drift -- this is exactly the fragility called out in
 * the architecture's risk-mitigation section. AdapterRunLog (Phase 2/3) should alert when the
 * extracted-item count silently drops to 0, which is the first sign of a selector change.
 */
export async function searchEbay(
  query: ProductQuery,
  opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  const pool = getSharedBrowserPool();
  const context = await pool.acquireContext({ adapterId: RETAILER_ID });
  const page = await context.newPage();

  try {
    // Split the outer per-adapter budget (registry.ts races the whole call against opts.timeoutMs)
    // across the two sequential awaits below so neither step alone can exceed -- and silently
    // orphan -- the outer deadline.
    const stepTimeoutMs = Math.floor(opts.timeoutMs / 2);
    const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query.rawQuery)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: stepTimeoutMs });
    await page.waitForSelector(".s-item", { timeout: stepTimeoutMs }).catch(async () => {
      logger.warn({ searchUrl }, "eBay search: no .s-item results found, page markup may have changed");
      await captureDebugArtifact(page, RETAILER_ID);
    });

    const items = await page.$$eval(
      ".s-item",
      (nodes, maxResults) =>
        nodes
          .slice(0, maxResults)
          .map((node) => {
            const title = node.querySelector(".s-item__title")?.textContent?.trim() ?? "";
            const priceText = node.querySelector(".s-item__price")?.textContent?.trim() ?? "";
            const url = node.querySelector<HTMLAnchorElement>(".s-item__link")?.href ?? "";
            const imageUrl = node.querySelector<HTMLImageElement>(".s-item__image-img")?.src;
            return { title, priceText, url, imageUrl };
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
  const priceMatch = item.priceText.replace(/,/g, "").match(/([\d]+\.\d{2})/);
  if (!priceMatch) return null;

  const amountMinorUnits = Math.round(parseFloat(priceMatch[1]) * 100);
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
