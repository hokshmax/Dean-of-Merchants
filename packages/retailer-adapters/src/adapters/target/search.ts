import { captureDebugArtifact, getSharedBrowserPool } from "@dean/scraping-kernel";
import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";
import { parsePriceToMinorUnits } from "../../heuristics/price-parsing";

const logger = createLogger("retailer-adapters:target");

const RETAILER_ID = "target";
const RETAILER_NAME = "Target";

/**
 * Scrapes Target's search results page using its `data-test` attributes, which Target uses
 * fairly consistently for its own UI test hooks. Still unverified against a live run --
 * needs the same real-world tuning as the other adapters.
 */
export async function searchTarget(
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
    const searchUrl = `https://www.target.com/s?searchTerm=${encodeURIComponent(query.rawQuery)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: stepTimeoutMs });
    await page
      .waitForSelector('[data-test="product-title"]', { timeout: stepTimeoutMs })
      .catch(async () => {
        logger.warn({ searchUrl }, "Target search: no results found, page markup may have changed");
        await captureDebugArtifact(page, RETAILER_ID);
      });

    const items = await page.$$eval(
      '[data-test="product-title"]',
      (nodes, maxResults) =>
        nodes
          .slice(0, maxResults)
          .map((titleNode) => {
            // Walk up to the nearest ancestor that both links somewhere and contains a price --
            // exact card structure is unverified, so this adapts rather than assuming one depth.
            let container: HTMLElement | null = titleNode.parentElement;
            for (let i = 0; i < 6 && container; i++) {
              if (container.querySelector("a") && container.querySelector('[data-test="current-price"], [data-test="product-price"]')) {
                break;
              }
              container = container.parentElement;
            }
            const anchor = container?.querySelector<HTMLAnchorElement>("a");
            const priceEl = container?.querySelector('[data-test="current-price"], [data-test="product-price"]');
            const imgEl = container?.querySelector<HTMLImageElement>("img");
            return {
              title: titleNode.textContent?.trim() ?? "",
              priceText: priceEl?.textContent?.trim() ?? "",
              url: anchor?.href ?? "",
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
