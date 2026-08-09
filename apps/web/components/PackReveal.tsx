"use client";

import { useState, type ReactNode } from "react";
import type { Design } from "@dean/shared-types";

type Stage = "closed" | "shaking" | "revealed";

const SHAKE_DURATION_MS = 900;

/**
 * FIFA-Ultimate-Team-style pack-opening reveal for a freshly generated design: starts as a
 * glowing, unopened "pack" the user taps, shakes briefly, then pops open into the real design
 * with a shine sweep before showing the buy flow (passed as children, rendered once revealed).
 */
export function PackReveal({ design, children }: { design: Design; children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("closed");

  function open() {
    if (stage !== "closed") return;
    setStage("shaking");
    setTimeout(() => setStage("revealed"), SHAKE_DURATION_MS);
  }

  if (stage !== "revealed") {
    return (
      <button
        onClick={open}
        className={stage === "shaking" ? "pack-shaking pack-glowing" : "pack-glowing"}
        style={{
          width: "100%",
          aspectRatio: "1",
          borderRadius: 20,
          border: "none",
          cursor: stage === "closed" ? "pointer" : "default",
          background: "linear-gradient(160deg, #2a1f4d 0%, #120c26 70%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          color: "var(--accent-gold)",
        }}
      >
        <span style={{ fontSize: 48 }}>🎁</span>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 0.5 }}>
          {stage === "shaking" ? "Opening..." : "Your design is ready — tap to open"}
        </span>
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="reveal-pop" style={{ position: "relative", overflow: "hidden", borderRadius: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- generated images are server-hosted */}
        <img src={design.imageUrl} alt={design.prompt} style={{ width: "100%", display: "block" }} />
        <div className="shine-sweep-overlay" />
      </div>
      <div className="fade-in-up">{children}</div>
    </div>
  );
}
