import Link from "next/link";

export default function OrderSuccessPage() {
  return (
    <main style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <h1>Order placed</h1>
      <p style={{ color: "#555" }}>
        Payment confirmed -- your design is on its way to print. You&apos;ll get a confirmation
        email shortly.
      </p>
      <Link
        href="/chat"
        style={{
          display: "inline-block",
          marginTop: 24,
          padding: "12px 24px",
          background: "#111",
          color: "#fff",
          borderRadius: 8,
          textDecoration: "none",
        }}
      >
        Design something else
      </Link>
    </main>
  );
}
