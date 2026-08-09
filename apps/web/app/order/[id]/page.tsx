"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatMoney } from "../../../lib/format";
import { resolveApiUrl } from "../../../lib/api-url";

interface OrderDetail {
  id: string;
  design: { imageUrl: string; prompt: string };
  size: string;
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
        <p style={{ color: "crimson" }}>{error}</p>
      </main>
    );
  }

  if (!order) {
    return (
      <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <p style={{ color: "#777" }}>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "60px auto", padding: "0 24px" }}>
      <h1>Order status</h1>

      {/* eslint-disable-next-line @next/next/no-img-element -- generated images are server-hosted */}
      <img
        src={order.design.imageUrl}
        alt={order.design.prompt}
        style={{ width: "100%", borderRadius: 8, marginBottom: 16 }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 15 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{STATUS_LABELS[order.status] ?? order.status}</div>
        <div>
          {order.size} x{order.quantity} --{" "}
          {formatMoney({ amountMinorUnits: order.retailPriceAmountMinorUnits, currency: order.currency })}
        </div>
        <div style={{ color: "#777" }}>Ordered {new Date(order.createdAt).toLocaleDateString()}</div>
        <div style={{ color: "#777" }}>Order ID: {order.id}</div>

        {order.trackingNumber && (
          <div style={{ marginTop: 12, padding: 12, background: "#f2f2f2", borderRadius: 8 }}>
            <div>
              {order.trackingCarrier ?? "Tracking"}: {order.trackingNumber}
            </div>
            {order.trackingUrl && (
              <a href={order.trackingUrl} target="_blank" rel="noreferrer">
                Track shipment
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
