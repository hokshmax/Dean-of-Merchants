"use client";

import { useEffect, useState } from "react";
import type { Design, SizeOption } from "@dean/shared-types";
import { formatMoney } from "../lib/format";
import { resolveApiUrl } from "../lib/api-url";

export function DesignCard({ design }: { design: Design }) {
  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [loadingSizes, setLoadingSizes] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoadingSizes(true);
    fetch(`${resolveApiUrl()}/orders/sizes`)
      .then((res) => res.json())
      .then((data: { sizes: SizeOption[] }) => {
        if (cancelled) return;
        setSizes(data.sizes);
        setSelectedSize(data.sizes[0]?.size);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoadingSizes(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function buy() {
    if (!selectedSize) return;
    setCheckingOut(true);
    setError(undefined);
    try {
      const res = await fetch(`${resolveApiUrl()}/orders/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: design.id, size: selectedSize, quantity }),
      });
      if (!res.ok) throw new Error(`Checkout failed: ${res.status}`);
      const data: { checkoutUrl: string } = await res.json();
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCheckingOut(false);
    }
  }

  const selectedOption = sizes.find((s) => s.size === selectedSize);

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

      {loadingSizes && <div style={{ color: "#777" }}>Loading sizes...</div>}

      {!loadingSizes && sizes.length > 0 && (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            Size
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
            >
              {sizes.map((s) => (
                <option key={s.size} value={s.size}>
                  {s.size} ({formatMoney(s.retailPrice)})
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

          {selectedOption && (
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18 }}>
              <span>Total</span>
              <span>
                {formatMoney({
                  amountMinorUnits: selectedOption.retailPrice.amountMinorUnits * quantity,
                  currency: selectedOption.retailPrice.currency,
                })}
              </span>
            </div>
          )}

          <button
            onClick={buy}
            disabled={checkingOut || !selectedSize}
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
