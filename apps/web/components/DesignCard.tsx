"use client";

import { useEffect, useState } from "react";
import { TSHIRT_COLORS, type Design, type SizeOption } from "@dean/shared-types";
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

const SIZE_LABELS: Record<string, string> = {
  S: "Small",
  M: "Medium",
  L: "Large",
  XL: "X-Large",
  XXL: "XX-Large",
};

export function DesignCard({ design, showImage = true }: { design: Design; showImage?: boolean }) {
  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string>(TSHIRT_COLORS[0].name);
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
          color: selectedColor,
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
  const inputStyle = {
    padding: 10,
    borderRadius: 10,
    border: "1px solid var(--surface-border)",
    background: "var(--surface)",
  };

  return (
    <div
      className="surface-card"
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element -- generated images are server-hosted, not part of the Next.js image pipeline
        <img
          src={design.imageUrl}
          alt={design.prompt}
          style={{ width: "100%", borderRadius: 12, objectFit: "cover" }}
        />
      )}

      {loadingSizes && <div style={{ color: "var(--text-secondary)" }}>Loading sizes...</div>}

      {!loadingSizes && sizes.length > 0 && !showShippingForm && (
        <>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>Color</div>
            <div style={{ display: "flex", gap: 10 }}>
              {TSHIRT_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
                  onClick={() => setSelectedColor(c.name)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: c.hex,
                    cursor: "pointer",
                    border:
                      selectedColor === c.name
                        ? "3px solid var(--accent-gold)"
                        : "2px solid var(--surface-border)",
                    boxShadow: selectedColor === c.name ? "0 0 12px var(--accent-gold-glow)" : "none",
                    transition: "all 0.15s ease",
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>Size</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {sizes.map((s) => (
                <button
                  key={s.size}
                  type="button"
                  onClick={() => setSelectedSize(s.size)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    color: selectedSize === s.size ? "#1a1305" : "var(--text-primary)",
                    background: selectedSize === s.size ? "var(--accent-gold)" : "var(--surface)",
                    border: `1px solid ${selectedSize === s.size ? "var(--accent-gold)" : "var(--surface-border)"}`,
                    transition: "all 0.15s ease",
                  }}
                >
                  {s.size} <span style={{ opacity: 0.75, fontWeight: 400 }}>({SIZE_LABELS[s.size] ?? s.size})</span>
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-secondary)" }}>
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
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 20 }}>
              <span>Total</span>
              <span style={{ color: "var(--accent-gold)" }}>
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
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "linear-gradient(135deg, var(--accent-gold), #d99418)",
              color: "#1a1305",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              fontSize: 15,
            }}
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
              style={{ flex: 1, padding: "12px 14px", borderRadius: 10, background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--surface-border)", cursor: "pointer" }}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={checkingOut}
              style={{
                flex: 2,
                padding: "12px 14px",
                borderRadius: 10,
                background: "linear-gradient(135deg, var(--accent-gold), #d99418)",
                color: "#1a1305",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              {checkingOut ? "Redirecting to payment..." : "Continue to payment"}
            </button>
          </div>
        </form>
      )}

      {error && <div style={{ color: "#ff6b6b" }}>{error}</div>}
    </div>
  );
}
