"use client";

import { useState } from "react";
import type { Design } from "@dean/shared-types";
import { DesignCard } from "../../components/DesignCard";
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
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 24px" }}>
      <h1>Eldorado</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {turns.map((turn, i) => (
          <div key={i} style={{ alignSelf: turn.role === "user" ? "flex-end" : "flex-start" }}>
            <div
              style={{
                background: turn.role === "user" ? "#111" : "#f2f2f2",
                color: turn.role === "user" ? "#fff" : "#111",
                padding: "10px 14px",
                borderRadius: 12,
                maxWidth: 480,
              }}
            >
              {turn.text}
            </div>
          </div>
        ))}
        {loading && <div style={{ color: "#777" }}>Generating...</div>}
        {error && <div style={{ color: "crimson" }}>{error}</div>}
      </div>

      <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe a design you want on a t-shirt"
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <button type="submit" disabled={loading} style={{ padding: "10px 20px", borderRadius: 8 }}>
          Send
        </button>
      </form>

      {design && <DesignCard design={design} />}
    </main>
  );
}
