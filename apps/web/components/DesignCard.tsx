"use client";

import { useEffect, useState } from "react";
import type { Design, SizeOption } from "@dean/shared-types";
import { formatMoney } from "../lib/format";
import { resolveApiUrl } from "../lib/api-url";

interface ShippingForm {
  name: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
}

const EMPTY_FORM: ShippingForm = {
  name: "",
  email: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "",
};

export function DesignCard({ design }: { design: Design }) {
  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [loadingSizes, setLoadingSizes] = useState(true);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [shipping, setShipping] = useState<ShippingForm>(EMPTY_FORM);
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

  function updateShipping(patch: Partial<ShippingForm>) {
    setShipping((prev) => ({ ...prev, ...patch }));
  }

  async function submitShipping(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSize) return;
    setCheckingOut(true);
    setError(undefined);
    try {
      const res = await fetch(`${resolveApiUrl()}/orders/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designId: design.id,
          size: selectedSize,
          quantity,
          recipientEmail: shipping.email,
          shippingAddress: {
            name: shipping.name,
            line1: shipping.line1,
            line2: shipping.line2 || undefined,
            city: shipping.city,
            region: shipping.region || undefined,
            postalCode: shipping.postalCode,
            countryCode: shipping.countryCode.toUpperCase(),
          },
        }),
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
  const inputStyle = { padding: 8, borderRadius: 8, border: "1px solid #ccc" };

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

      {!loadingSizes && sizes.length > 0 && !showShippingForm && (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            Size
            <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} style={inputStyle}>
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
              style={{ ...inputStyle, width: 80 }}
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
            onClick={() => setShowShippingForm(true)}
            disabled={!selectedSize}
            style={{ padding: "10px 12px", borderRadius: 8, background: "#111", color: "#fff", fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            Buy it
          </button>
        </>
      )}

      {showShippingForm && (
        <form onSubmit={submitShipping} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input required placeholder="Full name" value={shipping.name} onChange={(e) => updateShipping({ name: e.target.value })} style={inputStyle} />
          <input required type="email" placeholder="Email" value={shipping.email} onChange={(e) => updateShipping({ email: e.target.value })} style={inputStyle} />
          <input required placeholder="Address line 1" value={shipping.line1} onChange={(e) => updateShipping({ line1: e.target.value })} style={inputStyle} />
          <input placeholder="Address line 2 (optional)" value={shipping.line2} onChange={(e) => updateShipping({ line2: e.target.value })} style={inputStyle} />
          <div style={{ display: "flex", gap: 8 }}>
            <input required placeholder="City" value={shipping.city} onChange={(e) => updateShipping({ city: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="State/region" value={shipping.region} onChange={(e) => updateShipping({ region: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input required placeholder="Postal code" value={shipping.postalCode} onChange={(e) => updateShipping({ postalCode: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <input required placeholder="Country code (e.g. AE)" maxLength={2} value={shipping.countryCode} onChange={(e) => updateShipping({ countryCode: e.target.value })} style={{ ...inputStyle, width: 100 }} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowShippingForm(false)}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, background: "#eee", border: "none", cursor: "pointer" }}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={checkingOut}
              style={{ flex: 2, padding: "10px 12px", borderRadius: 8, background: "#111", color: "#fff", fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              {checkingOut ? "Redirecting to payment..." : "Continue to payment"}
            </button>
          </div>
        </form>
      )}

      {error && <div style={{ color: "crimson" }}>{error}</div>}
    </div>
  );
}
