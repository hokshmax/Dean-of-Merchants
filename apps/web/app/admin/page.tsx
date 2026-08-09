"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "../../lib/format";
import { resolveApiUrl } from "../../lib/api-url";

interface AdminOrder {
  id: string;
  design: { id: string; prompt: string; imageUrl: string };
  size: string;
  quantity: number;
  retailPriceAmountMinorUnits: number;
  currency: string;
  status: string;
  recipientEmail: string | null;
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingCity: string | null;
  shippingRegion: string | null;
  shippingPostalCode: string | null;
  shippingCountryCode: string | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: string;
}

const STATUSES = ["PENDING_PAYMENT", "PAID", "IN_PRODUCTION", "SHIPPED", "CANCELED"];
const TOKEN_STORAGE_KEY = "eldorado_admin_token";

export default function AdminPage() {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [tokenInput, setTokenInput] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [drafts, setDrafts] = useState<Record<string, Partial<AdminOrder>>>({});

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (token) loadOrders(token);
  }, [token]);

  async function loadOrders(adminToken: string) {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch(`${resolveApiUrl()}/admin/orders`, {
        headers: { "x-admin-token": adminToken },
      });
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(undefined);
        throw new Error("Invalid admin token");
      }
      if (!res.ok) throw new Error(`Failed to load orders: ${res.status}`);
      const data: { orders: AdminOrder[] } = await res.json();
      setOrders(data.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function submitToken(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenInput);
    setToken(tokenInput);
  }

  function updateDraft(orderId: string, patch: Partial<AdminOrder>) {
    setDrafts((prev) => ({ ...prev, [orderId]: { ...prev[orderId], ...patch } }));
  }

  async function saveOrder(orderId: string) {
    if (!token) return;
    const draft = drafts[orderId];
    if (!draft) return;
    try {
      const res = await fetch(`${resolveApiUrl()}/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      await loadOrders(token);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!token) {
    return (
      <main style={{ maxWidth: 400, margin: "80px auto", padding: "0 24px" }}>
        <h1>Admin</h1>
        <form onSubmit={submitToken} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Admin token"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <button type="submit" style={{ padding: "10px 20px", borderRadius: 8 }}>
            Enter
          </button>
        </form>
        {error && <div style={{ color: "crimson", marginTop: 12 }}>{error}</div>}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 24px" }}>
      <h1>Orders</h1>
      {loading && <div style={{ color: "#777" }}>Loading...</div>}
      {error && <div style={{ color: "crimson" }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {orders.map((order) => {
          const draft = drafts[order.id] ?? {};
          const address = [order.shippingLine1, order.shippingLine2, order.shippingCity, order.shippingRegion, order.shippingPostalCode, order.shippingCountryCode]
            .filter(Boolean)
            .join(", ");

          return (
            <div key={order.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, display: "flex", gap: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- generated images are server-hosted */}
              <img src={order.design.imageUrl} alt={order.design.prompt} style={{ width: 96, height: 96, borderRadius: 8, objectFit: "cover" }} />

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
                <div>
                  <strong>{order.id}</strong> -- {order.size} x{order.quantity} --{" "}
                  {formatMoney({ amountMinorUnits: order.retailPriceAmountMinorUnits, currency: order.currency })}
                </div>
                <div style={{ color: "#555" }}>{order.recipientEmail ?? "no email yet"}</div>
                <div style={{ color: "#555" }}>{order.shippingName}{address ? ` -- ${address}` : ""}</div>
                <div style={{ color: "#999" }}>{new Date(order.createdAt).toLocaleString()}</div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <select
                    value={draft.status ?? order.status}
                    onChange={(e) => updateDraft(order.id, { status: e.target.value })}
                    style={{ padding: 6, borderRadius: 6, border: "1px solid #ccc" }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Carrier"
                    defaultValue={order.trackingCarrier ?? ""}
                    onChange={(e) => updateDraft(order.id, { trackingCarrier: e.target.value })}
                    style={{ padding: 6, borderRadius: 6, border: "1px solid #ccc", width: 100 }}
                  />
                  <input
                    placeholder="Tracking number"
                    defaultValue={order.trackingNumber ?? ""}
                    onChange={(e) => updateDraft(order.id, { trackingNumber: e.target.value })}
                    style={{ padding: 6, borderRadius: 6, border: "1px solid #ccc", width: 140 }}
                  />
                  <input
                    placeholder="Tracking URL"
                    defaultValue={order.trackingUrl ?? ""}
                    onChange={(e) => updateDraft(order.id, { trackingUrl: e.target.value })}
                    style={{ padding: 6, borderRadius: 6, border: "1px solid #ccc", width: 180 }}
                  />
                  <button
                    onClick={() => saveOrder(order.id)}
                    disabled={!drafts[order.id]}
                    style={{ padding: "6px 14px", borderRadius: 6, background: "#111", color: "#fff", border: "none", cursor: "pointer" }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
