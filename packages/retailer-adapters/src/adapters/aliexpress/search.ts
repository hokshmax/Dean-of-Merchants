import { captureDebugArtifact, getSharedBrowserPool } from "@dean/scraping-kernel";
import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";
import { parsePriceToMinorUnits } from "../../heuristics/price-parsing";

const logger = createLogger("retailer-adapters:aliexpress");

const RETAILER_ID = "aliexpress";
const RETAILER_NAME = "AliExpress";

/**
 * AliExpress's search-result markup uses hashed/obfuscated class names that offer no stable
 * hook, so this doesn't try to target classes at all. Instead it anchors on product-detail
 * links (`/item/<id>.html`, a URL shape that's stayed stable far longer than any class name)
 * and scans each card's own text for a "$"-prefixed price rather than a specific selector.
 * This is meaningfully more fragile than the class-based adapters -- expect to need real
 * tuning here, and possibly CAPTCHA/anti-bot walls that block headless runs outright.
 */
export async function searchAliExpress(
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
    const searchUrl = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query.rawQuery)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: stepTimeoutMs });
    await page.waitForSelector('a[href*="/item/"]', { timeout: stepTimeoutMs }).catch(async () => {
      logger.warn({ searchUrl }, "AliExpress search: no item links found, page markup may have changed or blocked the request");
      await captureDebugArtifact(page, RETAILER_ID);
    });

    const items = await page.$$eval(
      'a[href*="/item/"]',
      (nodes, maxResults) => {
        const seen = new Set<string>();
        const results: { title: string; priceText: string; url: string; imageUrl?: string }[] = [];

        for (const node of nodes) {
          if (results.length >= maxResults) break;
          const anchor = node as HTMLAnchorElement;
          const url = anchor.href.split("?")[0];
          if (seen.has(url)) continue;

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
