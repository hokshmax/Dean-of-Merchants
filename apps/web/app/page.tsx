import Link from "next/link";
import { DesignGallery } from "../components/DesignGallery";

export default function HomePage() {
  return (
    <>
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "100px 24px 40px", textAlign: "center" }}>
        <h1
          style={{
            fontSize: 44,
            marginBottom: 8,
            background: "linear-gradient(135deg, var(--accent-gold), var(--accent-purple))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Eldorado
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 16, lineHeight: 1.6 }}>
          Describe a design and our AI creates the artwork. Pick a color and size, check out, and
          it gets printed on a t-shirt and shipped straight to you.
        </p>
        <Link
          href="/chat"
          style={{
            display: "inline-block",
            marginTop: 24,
            padding: "14px 28px",
            background: "linear-gradient(135deg, var(--accent-gold), #d99418)",
            color: "#1a1305",
            fontWeight: 700,
            borderRadius: 12,
            textDecoration: "none",
          }}
        >
          Design something
        </Link>
      </main>

      <DesignGallery />
    </>
  );
}
