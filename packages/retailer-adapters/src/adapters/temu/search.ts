import { getSharedBrowserPool } from "@dean/scraping-kernel";
import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";
import { parsePriceToMinorUnits } from "../../heuristics/price-parsing";

const logger = createLogger("retailer-adapters:temu");

const RETAILER_ID = "temu";
const RETAILER_NAME = "Temu";

/**
 * This is the highest-risk adapter in the registry. Temu's search-result markup uses
 * hashed class names that regenerate on every deploy (no stable class hook exists at all),
 * and it runs aggressive anti-bot/rate-limiting that frequently blocks headless browsers
 * outright regardless of selector correctness. Anchoring on product-detail link shape
 * (`...-g-<id>.html`) and scanning each card's own text for a price, same strategy as
 * AliExpress, because that's the only thing likely to survive a markup change here -- but
 * treat this adapter as the most likely of all of them to need real rework, not just tuning,
 * once tested live (e.g. it may need a different anti-bot approach entirely, not just
 * different selectors).
 */
export async function searchTemu(
  query: ProductQuery,
  opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  const pool = getSharedBrowserPool();
  const context = await pool.acquireContext({ adapterId: RETAILER_ID });
  const page = await context.newPage();

  try {
    const searchUrl = `https://www.temu.com/search_result.html?search_key=${encodeURIComponent(query.rawQuery)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs });
    await page.waitForSelector('a[href*="-g-"]', { timeout: opts.timeoutMs }).catch(() => {
      logger.warn({ searchUrl }, "Temu search: no product links found, page markup may have changed or blocked the request");
    });

    const items = await page.$$eval(
      'a[href*="-g-"]',
      (nodes, maxResults) => {
        const seen = new Set<string>();
        const results: { title: string; priceText: string; url: string; imageUrl?: string }[] = [];

        for (const node of nodes) {
          if (results.length >= maxResults) break;
          const anchor = node as HTMLAnchorElement;
          const url = anchor.href.split("?")[0];
          if (seen.has(url) || !/-g-\d+\.html$/.test(url)) continue;

          const container = anchor.closest("div") ?? anchor;
          const text = container.textContent ?? "";
          const priceMatch = text.match(/\$\s?[\d,]+\.\d{2}/);
          const img = anchor.querySelector<HTMLImageElement>("img") ?? container.querySelector<HTMLImageElement>("img");
          const title = img?.alt || anchor.textContent?.trim() || "";

          if (!title || !priceMatch) continue;
          seen.add(url);
          results.push({ title, priceText: priceMatch[0], url, imageUrl: img?.src });
        }

        return results;
      },
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
