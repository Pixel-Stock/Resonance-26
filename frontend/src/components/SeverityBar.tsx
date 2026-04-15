"use client";

import { motion } from "framer-motion";
import type { Anomaly, Severity } from "@/lib/types";

const LEVELS: { severity: Severity; color: string; bg: string; glow: string; label: string }[] = [
  { severity: "CRITICAL", color: "#fff", bg: "linear-gradient(135deg, #fb7185, #e11d48)", glow: "rgba(225,29,72,0.3)", label: "Critical" },
  { severity: "HIGH",     color: "#fff", bg: "linear-gradient(135deg, #fb923c, #ea580c)", glow: "rgba(234,88,12,0.3)", label: "High" },
  { severity: "MEDIUM",   color: "#fff", bg: "linear-gradient(135deg, #fbbf24, #d97706)", glow: "rgba(217,119,6,0.3)", label: "Medium" },
  { severity: "LOW",      color: "#fff", bg: "linear-gradient(135deg, #2dd4bf, #0d9488)", glow: "rgba(13,148,136,0.3)", label: "Low" },
];

interface SeverityBarProps {
  anomalies: Anomaly[];
  totalLogs: number;
}

export function SeverityBar({ anomalies, totalLogs }: SeverityBarProps) {
  const counts = Object.fromEntries(
    LEVELS.map((l) => [l.severity, anomalies.filter((a) => a.severity === l.severity).length])
  ) as Record<Severity, number>;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 250, damping: 22 }}
      className="glass"
      style={{ padding: "1rem 1.5rem" }}
    >
      <div className="flex flex-wrap items-center gap-3 sm:gap-6">
        {/* Total */}
        <div className="flex items-center gap-2 pr-4 sm:pr-6" style={{ borderRight: "1px solid rgba(255,255,255,0.3)" }}>
          <span className="text-2xl font-bold" style={{ color: "#1e293b" }}>{totalLogs}</span>
          <span className="text-xs uppercase tracking-wider font-medium" style={{ color: "#94a3b8" }}>Logs<br/>Parsed</span>
        </div>

        {/* Severity counts */}
        {LEVELS.map((l, i) => (
          <motion.div
            key={l.severity}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 + 0.1, type: "spring" }}
            className="flex items-center gap-2.5"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                background: l.bg,
                color: l.color,
                boxShadow: `0 4px 12px ${l.glow}, inset 0 1px 2px rgba(255,255,255,0.3)`,
              }}
            >
              {counts[l.severity]}
            </div>
            <span className="text-xs font-medium hidden sm:block" style={{ color: "#64748b" }}>
              {l.label}
            </span>
          </motion.div>
        ))}

        {/* Threat score bar */}
        <div className="flex-1 min-w-[120px] hidden md:block">
          <div className="flex justify-between text-[10px] font-mono mb-1" style={{ color: "#94a3b8" }}>
            <span>Threat Level</span>
            <span>{Math.round((anomalies.length / Math.max(totalLogs, 1)) * 100 * 10)}%</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.35)" }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((anomalies.length / Math.max(totalLogs, 1)) * 100 * 10, 100)}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
              style={{
                height: "100%",
                background: "linear-gradient(90deg, #2dd4bf, #fbbf24, #fb923c, #fb7185)",
                borderRadius: "999px",
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
