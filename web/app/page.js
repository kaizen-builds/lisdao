"use client";

import { useEffect, useState } from "react";

const STAGES = ["Demo", "Proposal", "Vote", "Agent", "Paid"];

function Stepper({ at = 0 }) {
  return (
    <div className="stepper" aria-label="Progress" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {STAGES.map((label, i) => {
        const isDone = i < at || at >= STAGES.length;
        const isNow = i === Math.min(at, STAGES.length - 1);

        return (
          <div
            key={label}
            className="st"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(148, 163, 184, 0.4)",
              background: isDone ? "#0f766e" : isNow ? "#1d4ed8" : "#0f172a",
              color: "white",
              opacity: isNow || isDone ? 1 : 0.7,
              minWidth: 120,
            }}
          >
            <span style={{ width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "rgba(255,255,255,0.18)" }}>
              {i < at ? "✓" : i + 1}
            </span>
            <em style={{ fontStyle: "normal", fontWeight: 600 }}>{label}</em>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((current) => (current + 1) % (STAGES.length + 1));
    }, 1600);

    return () => clearInterval(interval);
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 38%), #020817",
        color: "#e2e8f0",
        fontFamily: "Inter, Arial, sans-serif",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(100%, 980px)",
          background: "rgba(15, 23, 42, 0.8)",
          border: "1px solid rgba(148,163,184,0.25)",
          borderRadius: 24,
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.5)",
          padding: 32,
        }}
      >
        <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: 1.4, color: "#7dd3fc", fontWeight: 700 }}>
          NEAR · Sputnik DAO · AI Agent
        </p>

        <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)", margin: "16px 0 10px" }}>
          LisDao
        </h1>

        <p style={{ margin: "0 0 28px", fontSize: 18, lineHeight: 1.6, color: "#cbd5e1" }}>
          Your DAO votes. An AI agent does the job in a real browser. A NEAR contract pays, within limits the DAO sets.
        </p>

        <Stepper at={stage} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 18,
            marginTop: 28,
          }}
        >
          {[
            { title: "Community vote", text: "A council approves the task in Sputnik DAO." },
            { title: "Agent executes", text: "The browser agent follows the instructions on a live page." },
            { title: "Escrow safety", text: "The contract enforces caps and keeps funds in escrow." },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: "rgba(15, 118, 110, 0.12)",
                border: "1px solid rgba(94, 234, 212, 0.2)",
                borderRadius: 18,
                padding: 18,
              }}
            >
              <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>{item.title}</h2>
              <p style={{ margin: 0, lineHeight: 1.6, color: "#cbd5e1" }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
