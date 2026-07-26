import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <h1>Dean of Merchants</h1>
      <p style={{ color: "#555" }}>
        Tell our AI what you want to buy. We compare local and global retailers, show you the
        real total cost, and buy it for you once you pay.
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
        Start searching
      </Link>
    </main>
  );
}
