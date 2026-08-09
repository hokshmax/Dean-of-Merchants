"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatMoney } from "../../../lib/format";
import { resolveApiUrl } from "../../../lib/api-url";

interface OrderDetail {
  id: string;
  design: { imageUrl: string; prompt: string };
  size: string;
  color: string;
  quantity: number;
  retailPriceAmountMinorUnits: number;
  currency: string;
  status: string;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Payment confirmed -- queued for production",
  IN_PRODUCTION: "In production",
  SHIPPED: "Shipped",
  CANCELED: "Canceled",
};

export default function OrderTrackingPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch(`${resolveApiUrl()}/orders/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Order not found: ${res.status}`);
        return res.json();
      })
      .then((data: { order: OrderDetail }) => setOrder(data.order))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [params.id]);

  if (error) {
    return (
      <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <p style={{ color: "#ff6b6b" }}>{error}</p>
      </main>
    );
  }

  if (!order) {
    return (
      <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "60px auto", padding: "0 24px 80px" }}>
      <h1>Order status</h1>

      <div className="surface-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- generated images are server-hosted */}
        <img src={order.design.imageUrl} alt={order.design.prompt} style={{ width: "100%", borderRadius: 12 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 15 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: "var(--accent-gold)" }}>
            {STATUS_LABELS[order.status] ?? order.status}
          </div>
          <div>
            {order.size}, {order.color} x{order.quantity} --{" "}
            {formatMoney({ amountMinorUnits: order.retailPriceAmountMinorUnits, currency: order.currency })}
          </div>
          <div style={{ color: "var(--text-secondary)" }}>Ordered {new Date(order.createdAt).toLocaleDateString()}</div>
          <div style={{ color: "var(--text-secondary)" }}>Order ID: {order.id}</div>

          {order.trackingNumber && (
            <div style={{ marginTop: 8, padding: 12, background: "var(--surface-strong)", borderRadius: 10 }}>
              <div>
                {order.trackingCarrier ?? "Tracking"}: {order.trackingNumber}
              </div>
              {order.trackingUrl && (
                <a href={order.trackingUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent-gold)" }}>
                  Track shipment
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
