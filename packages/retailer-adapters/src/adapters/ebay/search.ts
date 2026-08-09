import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import { createLogger } from "@dean/logger";
import { getEbayAccessToken } from "./oauth-token";

const logger = createLogger("retailer-adapters:ebay");

const RETAILER_ID = "ebay";
const RETAILER_NAME = "eBay";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

interface EbayItemSummary {
  itemId: string;
  title: string;
  itemWebUrl: string;
  price?: { value: string; currency: string };
  image?: { imageUrl: string };
}

interface EbaySearchResponse {
  itemSummaries?: EbayItemSummary[];
}

/**
 * Uses eBay's official Browse API instead of scraping the search-results page -- scraping was
 * consistently blocked by an anti-bot challenge regardless of source IP (confirmed via debug
 * screenshots showing eBay's "SORRY - Something went wrong" block page even from a residential
 * IP). Requires a free eBay developer keyset (EBAY_APP_ID/EBAY_CERT_ID); returns no results
 * (rather than attempting an unauthenticated call) when unset.
 *
 * When EBAY_CAMPAIGN_ID is set (an eBay Partner Network campaign ID), returned item URLs are
 * tagged with EPN tracking parameters so purchases the user completes on eBay attribute
 * commission back to this app. Written to EPN's documented manual-link-tagging format;
 * unverified against a live campaign since no real campaign ID has been tested yet.
 */
export async function searchEbay(
  query: ProductQuery,
  opts: SearchOptions,
): Promise<RetailerOfferResult[]> {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) {
    logger.warn("eBay adapter not configured -- set EBAY_APP_ID and EBAY_CERT_ID to enable it");
    return [];
  }

  const accessToken = await getEbayAccessToken(appId, certId);
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query.rawQuery);
  url.searchParams.set("limit", String(opts.maxResults));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.warn({ status: response.status, body }, "eBay Browse API request failed");
      return [];
    }

    const data = (await response.json()) as EbaySearchResponse;
    return (data.itemSummaries ?? [])
      .map((item) => parseOffer(item))
      .filter((offer): offer is RetailerOfferResult => offer !== null);
  } finally {
    clearTimeout(timeout);
  }
}

function parseOffer(item: EbayItemSummary): RetailerOfferResult | null {
  if (!item.price) return null;

  const amountMinorUnits = Math.round(parseFloat(item.price.value) * 100);
  if (Number.isNaN(amountMinorUnits)) return null;

  const offerId = `${RETAILER_ID}:${Buffer.from(item.itemId).toString("base64url").slice(0, 24)}`;

  return {
    retailerId: RETAILER_ID,
    retailerName: RETAILER_NAME,
    offerId,
    title: item.title,
    url: applyEpnTracking(item.itemWebUrl),
    imageUrl: item.image?.imageUrl,
    price: { amountMinorUnits, currency: item.price.currency },
    availability: "in_stock",
    scrapedAt: new Date(),
  };
}

function applyEpnTracking(itemWebUrl: string): string {
  const campaignId = process.env.EBAY_CAMPAIGN_ID;
  if (!campaignId) return itemWebUrl;

  const url = new URL(itemWebUrl);
  url.searchParams.set("campid", campaignId);
  url.searchParams.set("toolid", "10001");
  url.searchParams.set("mkevt", "1");
  url.searchParams.set("mkcid", "1");
  return url.toString();
}
