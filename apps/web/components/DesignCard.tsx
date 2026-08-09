"use client";

import { useEffect, useState } from "react";
import type { Design, Money } from "@dean/shared-types";
import { formatMoney } from "../lib/format";
import { resolveApiUrl } from "../lib/api-url";

interface Variant {
  variantId: number;
  productName: string;
  size: string;
  color: string;
  retailPrice: Money;
}

export function DesignCard({ design }: { design: Design }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [loadingVariants, setLoadingVariants] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoadingVariants(true);
    fetch(`${resolveApiUrl()}/orders/variants`)
      .then((res) => res.json())
      .then((data: { variants: Variant[] }) => {
        if (cancelled) return;
        setVariants(data.variants);
        setSelectedVariantId(data.variants[0]?.variantId);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoadingVariants(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function buy() {
    if (!selectedVariantId) return;
    setCheckingOut(true);
    setError(undefined);
    try {
      const res = await fetch(`${resolveApiUrl()}/orders/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: design.id, variantId: selectedVariantId, quantity }),
      });
      if (!res.ok) throw new Error(`Checkout failed: ${res.status}`);
      const data: { checkoutUrl: string } = await res.json();
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCheckingOut(false);
    }
  }

  const selectedVariant = variants.find((v) => v.variantId === selectedVariantId);

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- generated images are server-hosted, not part of the Next.js image pipeline */}
      <img
        src={design.imageUrl}
        alt={design.prompt}
        style={{ width: "100%", borderRadius: 8, objectFit: "cover" }}
      />

      {loadingVariants && <div style={{ color: "#777" }}>Loading sizes...</div>}

      {!loadingVariants && variants.length > 0 && (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            Size / color
            <select
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(Number(e.target.value))}
              style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
            >
              {variants.map((v) => (
                <option key={v.variantId} value={v.variantId}>
                  {v.size} - {v.color} ({formatMoney(v.retailPrice)})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            Quantity
            <input
              type="number"
              min={1}
              max={10}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(10, Number(e.target.value))))}
              style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", width: 80 }}
            />
          </label>

          {selectedVariant && (
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18 }}>
              <span>Total</span>
              <span>
                {formatMoney({
                  amountMinorUnits: selectedVariant.retailPrice.amountMinorUnits * quantity,
                  currency: selectedVariant.retailPrice.currency,
                })}
              </span>
            </div>
          )}

          <button
            onClick={buy}
            disabled={checkingOut || !selectedVariantId}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "#111",
              color: "#fff",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            {checkingOut ? "Redirecting to checkout..." : "Buy it"}
          </button>
        </>
      )}

      {error && <div style={{ color: "crimson" }}>{error}</div>}
    </div>
  );
}
