"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Search, X } from "lucide-react";
import type { Anomaly, Severity } from "@/lib/types";

const SEV_COLORS: Record<Severity, string> = {
  CRITICAL: "#fb7185",
  HIGH:     "#fb923c",
  MEDIUM:   "#fbbf24",
  LOW:      "#2dd4bf",
};

const SEV_BG: Record<Severity, string> = {
  CRITICAL: "rgba(251,113,133,0.08)",
  HIGH:     "rgba(251,146,60,0.08)",
  MEDIUM:   "rgba(251,191,36,0.06)",
  LOW:      "rgba(45,212,191,0.06)",
};

// Highlight tokens in a raw log line
function HighlightedLine({ raw, isAnomaly, severity }: { raw: string; isAnomaly: boolean; severity?: Severity }) {
  // Patterns to highlight
  const parts: { text: string; type: "ip" | "timestamp" | "fail" | "ok" | "path" | "plain" }[] = [];

  let remaining = raw;
  const patterns: [RegExp, "ip" | "timestamp" | "fail" | "ok" | "path"][] = [
    [/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/, "ip"],
    [/\b([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\b/, "timestamp"],
    [/\b(Failed|FAILED|Error|ERROR|denied|DENIED|invalid|INVALID|unauthorized)\b/i, "fail"],
    [/\b(Accepted|SUCCESS|OK|opened|Connected)\b/i, "ok"],
    [/(?:\/[\w./-]+(?:\.\w+)?)+/, "path"],
  ];

  // Simple tokenizer
  while (remaining.length > 0) {
    let earliest: { index: number; length: number; type: "ip" | "timestamp" | "fail" | "ok" | "path" } | null = null;

    for (const [pattern, type] of patterns) {
      const match = remaining.match(pattern);
      if (match && match.index !== undefined) {
        if (!earliest || match.index < earliest.index) {
          earliest = { index: match.index, length: match[0].length, type };
        }
      }
    }

    if (!earliest) {
      parts.push({ text: remaining, type: "plain" });
      break;
    }

    if (earliest.index > 0) {
      parts.push({ text: remaining.slice(0, earliest.index), type: "plain" });
    }
    parts.push({ text: remaining.slice(earliest.index, earliest.index + earliest.length), type: earliest.type });
    remaining = remaining.slice(earliest.index + earliest.length);
  }

  return (
    <span>
      {parts.map((p, i) => {
        if (p.type === "ip")        return <span key={i} style={{ color: "#38bdf8" }}>{p.text}</span>;
        if (p.type === "timestamp") return <span key={i} style={{ color: "#64748b" }}>{p.text}</span>;
        if (p.type === "fail")      return <span key={i} style={{ color: isAnomaly && severity ? SEV_COLORS[severity] : "#fb7185", fontWeight: 600 }}>{p.text}</span>;
        if (p.type === "ok")        return <span key={i} style={{ color: isAnomaly ? (severity ? SEV_COLORS[severity] : "#fb7185") : "#4ade80", fontWeight: 600 }}>{p.text}</span>;
        if (p.type === "path")      return <span key={i} style={{ color: "#a78bfa" }}>{p.text}</span>;
        return <span key={i} style={{ color: "#94a3b8" }}>{p.text}</span>;
      })}
    </span>
  );
}

interface LogViewerProps {
  anomalies: Anomaly[];
  totalLogs: number;
}

export function LogViewer({ anomalies, totalLogs }: LogViewerProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "anomaly">("all");
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Flash new anomalies
  useEffect(() => {
    const newOnes = anomalies.filter((a) => a.id > prevCountRef.current);
    if (newOnes.length > 0) {
      const ids = new Set(newOnes.map((a) => a.id));
      setNewIds(ids);
      setTimeout(() => setNewIds(new Set()), 1200);
    }
    prevCountRef.current = Math.max(...anomalies.map((a) => a.id), 0);
  }, [anomalies]);

  const searchLower = search.toLowerCase();
  const displayed = anomalies.filter((a) => {
    if (filter === "anomaly") return true;
    if (search && !a.parsed_log.raw.toLowerCase().includes(searchLower)) return false;
    return true;
  });

  const normalCount = Math.max(totalLogs - anomalies.length, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.2 }}
      className="glass"
      style={{ padding: "1.25rem" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.35)" }}>
        <h2 className="text-sm uppercase font-semibold tracking-wider flex items-center gap-2" style={{ color: "#1e293b" }}>
          <Terminal className="w-4 h-4 text-violet-500" />
          Log Terminal
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>
            {totalLogs.toLocaleString()} lines · <span style={{ color: "#fb7185" }}>{anomalies.length} flagged</span>
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#64748b" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter logs..."
            style={{
              width: "100%",
              paddingLeft: "2rem",
              paddingRight: search ? "2rem" : "0.75rem",
              paddingTop: "6px",
              paddingBottom: "6px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(0,0,0,0.18)",
              color: "#e2e8f0",
              fontSize: "0.78rem",
              fontFamily: "var(--font-mono, monospace)",
              outline: "none",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 0, display: "flex" }}>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.2)" }}>
          {(["all", "anomaly"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "5px 12px",
                fontSize: "0.72rem",
                fontWeight: 600,
                background: filter === f ? "rgba(124,58,237,0.25)" : "transparent",
                color: filter === f ? "#a78bfa" : "#64748b",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {f === "all" ? "All Flagged" : "Anomalies Only"}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal body */}
      <div
        style={{
          background: "#0d1117",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        {/* Terminal chrome */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 6 }}>
          {["#fb7185", "#fbbf24", "#4ade80"].map((c) => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.7 }} />
          ))}
          <span style={{ marginLeft: 8, fontSize: "0.7rem", color: "#475569", fontFamily: "monospace" }}>
            /var/log/auth.log — {displayed.length} events shown
          </span>
        </div>

        {/* Log lines */}
        <div
          style={{
            maxHeight: 360,
            overflowY: "auto",
            padding: "8px 0",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.1) transparent",
          }}
        >
          {/* Normal log count indicator */}
          {filter === "all" && normalCount > 0 && (
            <div style={{ padding: "4px 14px", color: "#2d3748", fontSize: "0.7rem", fontFamily: "monospace" }}>
              ... {normalCount.toLocaleString()} normal log entries ...
            </div>
          )}

          <AnimatePresence>
            {displayed.map((a) => {
              const isNew = newIds.has(a.id);
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  style={{
                    padding: "3px 14px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    background: isNew
                      ? "rgba(251,113,133,0.15)"
                      : SEV_BG[a.severity],
                    transition: "background 0.6s ease",
                    borderLeft: `2px solid ${SEV_COLORS[a.severity]}`,
                    marginBottom: 1,
                  }}
                >
                  {/* Line number */}
                  <span style={{ fontSize: "0.65rem", color: "#2d3748", fontFamily: "monospace", minWidth: 28, textAlign: "right", flexShrink: 0, marginTop: 1 }}>
                    {a.id}
                  </span>
                  {/* Severity badge */}
                  <span style={{
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    color: SEV_COLORS[a.severity],
                    fontFamily: "monospace",
                    minWidth: 36,
                    flexShrink: 0,
                    marginTop: 1,
                  }}>
                    {a.severity.slice(0, 4)}
                  </span>
                  {/* Log content */}
                  <span style={{ fontSize: "0.72rem", fontFamily: "monospace", lineHeight: 1.5, wordBreak: "break-all" }}>
                    <HighlightedLine raw={a.parsed_log.raw} isAnomaly severity={a.severity} />
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {displayed.length === 0 && (
            <div style={{ padding: "24px 14px", textAlign: "center", color: "#2d3748", fontSize: "0.75rem", fontFamily: "monospace" }}>
              no matching entries
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </motion.div>
  );
}
