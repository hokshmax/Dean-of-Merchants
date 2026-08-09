"use client";

import { useEffect, useState } from "react";
import type { Design } from "@dean/shared-types";
import { DesignCard } from "./DesignCard";
import { resolveApiUrl } from "../lib/api-url";

export function DesignGallery() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [selected, setSelected] = useState<Design | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${resolveApiUrl()}/designs`)
      .then((res) => res.json())
      .then((data: { designs: Design[] }) => setDesigns(data.designs))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (designs.length === 0) return null;

  return (
    <section style={{ maxWidth: 960, margin: "48px auto", padding: "0 24px" }}>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Designs the community made</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
        {designs.map((design) => (
          <button
            key={design.id}
            onClick={() => setSelected(design)}
            style={{ border: "none", padding: 0, cursor: "pointer", background: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- generated images are server-hosted */}
            <img
              src={design.imageUrl}
              alt={design.prompt}
              style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }}
            />
          </button>
        ))}
      </div>

      {selected && (
        <div style={{ maxWidth: 360, margin: "24px auto 0" }}>
          <DesignCard design={selected} />
        </div>
      )}
    </section>
  );
}
