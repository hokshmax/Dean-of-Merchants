"use client";

import { useState } from "react";
import type { Design } from "@dean/shared-types";
import { DesignCard } from "../../components/DesignCard";
import { PackReveal } from "../../components/PackReveal";
import { resolveApiUrl } from "../../lib/api-url";

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [design, setDesign] = useState<Design | undefined>(undefined);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setTurns((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    setLoading(true);
    setError(undefined);

    try {
      const res = await fetch(`${resolveApiUrl()}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data = await res.json();
      setSessionId(data.sessionId);
      setTurns((prev) => [...prev, { role: "assistant", text: data.assistantText }]);
      if (data.design) setDesign(data.design);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Eldorado</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {turns.map((turn, i) => (
          <div key={i} style={{ alignSelf: turn.role === "user" ? "flex-end" : "flex-start" }}>
            <div
              className={turn.role === "assistant" ? "surface-card" : undefined}
              style={{
                background: turn.role === "user" ? "linear-gradient(135deg, var(--accent-purple), #5a3fd6)" : undefined,
                color: turn.role === "user" ? "#fff" : "var(--text-primary)",
                padding: "10px 14px",
                borderRadius: 14,
                maxWidth: 440,
              }}
            >
              {turn.text}
            </div>
          </div>
        ))}
        {loading && <div style={{ color: "var(--text-secondary)" }}>Generating...</div>}
        {error && <div style={{ color: "#ff6b6b" }}>{error}</div>}
      </div>

      <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe a design you want on a t-shirt"
          style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid var(--surface-border)" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 22px",
            borderRadius: 10,
            background: "linear-gradient(135deg, var(--accent-gold), #d99418)",
            color: "#1a1305",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </form>

      {design && (
        <PackReveal design={design}>
          <DesignCard design={design} showImage={false} />
        </PackReveal>
      )}
    </main>
  );
}
