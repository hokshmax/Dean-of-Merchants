import Link from "next/link";
import { DesignGallery } from "../components/DesignGallery";

export default function HomePage() {
  return (
    <>
      <main style={{ maxWidth: 640, margin: "80px auto 0", padding: "0 24px", textAlign: "center" }}>
        <h1>Eldorado</h1>
        <p style={{ color: "#555" }}>
          Describe a design and our AI creates the artwork. Pick a size, check out, and it gets
          printed on a t-shirt and shipped straight to you.
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
          Design something
        </Link>
      </main>

      <DesignGallery />
    </>
  );
}
