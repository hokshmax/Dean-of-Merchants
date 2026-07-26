import { Injectable } from "@nestjs/common";
import { createDefaultAdapterRegistry, type AdapterRegistry } from "@dean/retailer-adapters";
import { buildQuoteBreakdown } from "@dean/pricing-engine";
import type { OfferQuote, ProductQuery, SearchOptions } from "@dean/shared-types";
import type { SearchProductsInput, SearchProductsToolResult } from "@dean/ai-orchestration";
import { createLogger } from "@dean/logger";

const logger = createLogger("api:search");

export interface SearchDestination {
  countryCode: string;
  currency: string;
}

@Injectable()
export class SearchService {
  private readonly registry: AdapterRegistry = createDefaultAdapterRegistry();

  async search(
    input: SearchProductsInput,
    destination: SearchDestination,
  ): Promise<SearchProductsToolResult> {
    const query: ProductQuery = {
      rawQuery: input.rawQuery,
      brand: input.brand,
      model: input.model,
      attributes: input.attributes,
      budgetMaxMinorUnits: input.budgetMaxMinorUnits,
      currency: destination.currency,
      destinationCountryCode: destination.countryCode,
      condition: input.condition,
    };
    const opts: SearchOptions = { timeoutMs: 15_000, maxResults: 5 };

    const { offers, failures } = await this.registry.searchAll(query, opts);
    if (failures.length > 0) {
      logger.warn({ failures }, "one or more retailer adapters failed during search");
    }

    const offerQuotes: OfferQuote[] = [];
    for (const offer of offers) {
      const adapter = this.registry.get(offer.retailerId);
      if (!adapter) continue;

      // Only the destination country is known at search time; a full shipping address is
      // collected at checkout. estimateShippingAndTax only needs countryCode today, but the
      // full Address shape is kept so a future real tax/shipping provider isn't blocked on it.
      const estimate = await adapter.estimateShippingAndTax(offer, {
        line1: "",
        city: "",
        postalCode: "",
        countryCode: destination.countryCode,
      });

      const quote = buildQuoteBreakdown({ offer, estimate });
      offerQuotes.push({ offer, quote });
    }

    offerQuotes.sort((a, b) => a.quote.totalCharge.amountMinorUnits - b.quote.totalCharge.amountMinorUnits);

    return { offers: offerQuotes, failedRetailers: failures.map((f) => f.retailerId) };
  }
}
