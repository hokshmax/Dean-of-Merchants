import { captureDebugArtifact, getSharedBrowserPool } from "@dean/scraping-kernel";
import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";

const logger = createLogger("retailer-adapters:amazon");

const RETAILER_ID = "amazon";
const RETAILER_NAME = "Amazon";

/**
 * Amazon is the deliberately "harder" of the two Phase 1 adapters: aggressive anti-bot
 * detection (CAPTCHAs, IP-based rate limiting) means this adapter will fail far more often
 * than eBay's in practice. That's intentional -- proving the adapter interface holds up
 * against a hostile target is the point of including it early, per the architecture's
 * risk-mitigation strategy (circuit breaker + DEGRADED status handle the frequent failures).
 */
export async function searchAmazon(
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
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query.rawQuery)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: stepTimeoutMs });

    const captchaDetected = await page
      .locator("form[action='/errors/validateCaptcha']")
      .count()
      .catch(() => 0);
    if (captchaDetected > 0) {
      throw new Error("Amazon presented a CAPTCHA challenge; search aborted for this run");
    }

    await page
      .waitForSelector("[data-component-type='s-search-result']", { timeout: stepTimeoutMs })
      .catch(async () => {
        logger.warn({ searchUrl }, "Amazon search: no results found, page markup may have changed");
        await captureDebugArtifact(page, RETAILER_ID);
      });

    const items = await page.$$eval(
      "[data-component-type='s-search-result']",
      (nodes, maxResults) =>
        nodes
          .slice(0, maxResults)
          .map((node) => {
            const title = node.querySelector("h2 span")?.textContent?.trim() ?? "";
            const priceWhole = node.querySelector(".a-price-whole")?.textContent?.replace(/[^\d]/g, "");
            const priceFraction = node.querySelector(".a-price-fraction")?.textContent?.replace(/[^\d]/g, "");
            const relativeUrl = node.querySelector<HTMLAnchorElement>("h2 a")?.getAttribute("href") ?? "";
            const imageUrl = node.querySelector<HTMLImageElement>(".s-image")?.src;
            return { title, priceWhole, priceFraction, relativeUrl, imageUrl };
          })
          .filter((item) => item.title && item.relativeUrl && item.priceWhole),
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
  priceWhole?: string;
  priceFraction?: string;
  relativeUrl: string;
  imageUrl?: string;
}): RetailerOfferResult | null {
  if (!item.priceWhole) return null;

  const fraction = (item.priceFraction ?? "00").padEnd(2, "0").slice(0, 2);
  const amountMinorUnits = parseInt(item.priceWhole, 10) * 100 + parseInt(fraction, 10);
  const url = item.relativeUrl.startsWith("http")
    ? item.relativeUrl
    : `https://www.amazon.com${item.relativeUrl}`;
  const offerId = `${RETAILER_ID}:${Buffer.from(url).toString("base64url").slice(0, 24)}`;

  return {
    retailerId: RETAILER_ID,
    retailerName: RETAILER_NAME,
    offerId,
    title: item.title,
    url,
    imageUrl: item.imageUrl,
    price: { amountMinorUnits, currency: "USD" },
    availability: "in_stock",
    scrapedAt: new Date(),
  };
}
