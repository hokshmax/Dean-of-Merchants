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

      <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 4, margin: "8px 0" }}>
        <dt>Product price</dt>
        <dd>{formatMoney(quote.productPrice)}</dd>
        <dt>Estimated shipping</dt>
        <dd>{formatMoney(quote.shippingCost)}</dd>
        <dt>Estimated tax</dt>
        <dd>{formatMoney(quote.taxAmount)}</dd>
      </dl>

      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18, borderTop: "1px solid #eee", paddingTop: 8 }}>
        <span>Estimated total</span>
        <span>{formatMoney(quote.totalCharge)}</span>
      </div>

      <a
        href={offer.url}
        target="_blank"
        rel="noreferrer"
        style={{
          textAlign: "center",
          marginTop: 4,
          padding: "10px 12px",
          borderRadius: 8,
          background: "#0645ad",
          color: "#fff",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Continue to {offer.retailerName} to buy
      </a>
    </div>
  );
}
