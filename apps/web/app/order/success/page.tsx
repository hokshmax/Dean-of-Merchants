"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderSuccessPage() {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order_id");
    if (!orderId) {
      setError("Missing order reference -- your payment may still have gone through, check your email.");
      return;
    }
    router.replace(`/order/${orderId}`);
  }, [router]);

  return (
    <main style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <h1>Order placed</h1>
      <p style={{ color: "#555" }}>{error ?? "Payment confirmed -- loading your order..."}</p>
    </main>
  );
}
