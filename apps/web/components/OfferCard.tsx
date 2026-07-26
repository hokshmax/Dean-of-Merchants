import type { OfferQuote } from "@dean/shared-types";
import { formatMoney } from "../lib/format";

export function OfferCard({ offerQuote }: { offerQuote: OfferQuote }) {
  const { offer, quote } = offerQuote;

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong>{offer.title}</strong>
        <span style={{ color: "#777", fontSize: 13 }}>{offer.retailerName}</span>
      </div>

      <a href={offer.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#0645ad" }}>
        View original listing
      </a>

      <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 4, margin: "8px 0" }}>
        <dt>Product price</dt>
        <dd>{formatMoney(quote.productPrice)}</dd>
        <dt>Shipping</dt>
        <dd>{formatMoney(quote.shippingCost)}</dd>
        <dt>Tax</dt>
        <dd>{formatMoney(quote.taxAmount)}</dd>
        <dt>Our fee ({(quote.platformFeeRate * 100).toFixed(1)}% of product price)</dt>
        <dd>{formatMoney(quote.platformFee)}</dd>
      </dl>

      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18, borderTop: "1px solid #eee", paddingTop: 8 }}>
        <span>Total</span>
        <span>{formatMoney(quote.totalCharge)}</span>
      </div>
    </div>
  );
}
