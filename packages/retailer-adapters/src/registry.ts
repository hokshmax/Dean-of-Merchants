import { createLogger } from "@dean/logger";
import type { ProductQuery, RetailerOfferResult, SearchOptions } from "@dean/shared-types";
import type { RetailerAdapter } from "./types";

const logger = createLogger("retailer-adapters:registry");

export interface FanOutSearchResult {
  offers: RetailerOfferResult[];
  failures: { retailerId: string; reason: string }[];
}

/**
 * Holds every registered retailer adapter and fans searches out across all of them in
 * parallel. A single adapter timing out or throwing never prevents the others' results
 * from coming back -- this is what keeps one broken scraper from degrading the whole search.
 */
export class AdapterRegistry {
  private readonly adapters = new Map<string, RetailerAdapter>();

  register(adapter: RetailerAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Retailer adapter "${adapter.id}" is already registered`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): RetailerAdapter | undefined {
    return this.adapters.get(id);
  }

  getAll(): RetailerAdapter[] {
    return [...this.adapters.values()];
  }

  getForRegion(regionCode: string): RetailerAdapter[] {
    return this.getAll().filter((a) => a.supportedRegions.includes(regionCode));
  }

  async searchAll(query: ProductQuery, opts: SearchOptions): Promise<FanOutSearchResult> {
    const candidates = this.getForRegion(query.destinationCountryCode);
    const targets = candidates.length > 0 ? candidates : this.getAll();

    const results = await Promise.allSettled(
      targets.map((adapter) => withTimeout(adapter.search(query, opts), opts.timeoutMs, adapter.id)),
    );

    const offers: RetailerOfferResult[] = [];
    const failures: FanOutSearchResult["failures"] = [];

    results.forEach((result, i) => {
      const retailerId = targets[i].id;
      if (result.status === "fulfilled") {
        offers.push(...result.value);
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        logger.warn({ retailerId, reason }, "retailer search failed");
        failures.push({ retailerId, reason });
      }
    });

    return { offers, failures };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, retailerId: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Adapter "${retailerId}" search timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}
