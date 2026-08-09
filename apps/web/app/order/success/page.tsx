"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveApiUrl } from "../../../lib/api-url";

export default function OrderSuccessPage() {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId) {
      setError("Missing checkout session -- your payment may still have gone through, check your email.");
      return;
    }

    fetch(`${resolveApiUrl()}/orders/by-session/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not find order: ${res.status}`);
        return res.json();
      })
      .then((data: { orderId: string }) => router.replace(`/order/${data.orderId}`))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [router]);

  return (
    <main style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <h1>Order placed</h1>
      <p style={{ color: "#555" }}>
        {error ?? "Payment confirmed -- loading your order..."}
      </p>
    </main>
  );
}
