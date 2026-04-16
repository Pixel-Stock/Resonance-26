"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Anomaly, Severity } from "@/lib/types";

const LEVELS: { severity: Severity; color: string; bg: string; glow: string; label: string }[] = [
  { severity: "CRITICAL", color: "#fff", bg: "linear-gradient(135deg, #fb7185, #e11d48)", glow: "rgba(225,29,72,0.3)",   label: "Critical" },
  { severity: "HIGH",     color: "#fff", bg: "linear-gradient(135deg, #fb923c, #ea580c)", glow: "rgba(234,88,12,0.3)",   label: "High"     },
  { severity: "MEDIUM",   color: "#fff", bg: "linear-gradient(135deg, #fbbf24, #d97706)", glow: "rgba(217,119,6,0.3)",   label: "Medium"   },
  { severity: "LOW",      color: "#fff", bg: "linear-gradient(135deg, #2dd4bf, #0d9488)", glow: "rgba(13,148,136,0.3)",  label: "Low"      },
];

/** Animates a number from 0 to target */
function useCountUp(target: number, duration = 600): number {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = val;

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setVal(Math.round(from + (target - from) * ease));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return val;
}

/** "updated X s ago" label that ticks every second */
function LastUpdated() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const label =
    secs < 5  ? "just now" :
    secs < 60 ? `${secs}s ago` :
    `${Math.floor(secs / 60)}m ago`;

  return (
    <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontFamily: "monospace" }}>
      updated {label}
    </span>
  );
}

interface SeverityBarProps {
  anomalies: Anomaly[];
  totalLogs: number;
}

export function SeverityBar({ anomalies, totalLogs }: SeverityBarProps) {
  const counts = Object.fromEntries(
    LEVELS.map((l) => [l.severity, anomalies.filter((a) => a.severity === l.severity).length])
  ) as Record<Severity, number>;

  const animatedTotal = useCountUp(totalLogs, 800);
  const threatPct = Math.min((anomalies.length / Math.max(totalLogs, 1)) * 100 * 10, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 250, damping: 22 }}
      className="glass"
      style={{ padding: "1rem 1.5rem" }}
    >
      <div className="flex flex-wrap items-center gap-3 sm:gap-6">
        {/* Total logs — animated */}
        <div className="flex items-center gap-2 pr-4 sm:pr-6" style={{ borderRight: "1px solid rgba(255,255,255,0.3)" }}>
          <motion.span
            key={animatedTotal}
            className="text-2xl font-bold tabular-nums"
            style={{ color: "#1e293b" }}
          >
            {animatedTotal.toLocaleString()}
          </motion.span>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider font-medium" style={{ color: "#94a3b8" }}>Logs Parsed</span>
            <LastUpdated />
          </div>
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
            <motion.div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold tabular-nums"
              style={{
                background: l.bg,
                color: l.color,
                boxShadow: `0 4px 12px ${l.glow}, inset 0 1px 2px rgba(255,255,255,0.3)`,
              }}
              animate={{ scale: counts[l.severity] > 0 ? [1, 1.18, 1] : 1 }}
              transition={{ duration: 0.4, delay: i * 0.08 + 0.15 }}
            >
              {counts[l.severity]}
            </motion.div>
            <span className="text-xs font-medium hidden sm:block" style={{ color: "#64748b" }}>
              {l.label}
            </span>
          </motion.div>
        ))}

        {/* Threat level bar */}
        <div className="flex-1 min-w-[120px] hidden md:block">
          <div className="flex justify-between text-[10px] font-mono mb-1" style={{ color: "#94a3b8" }}>
            <span>Threat Level</span>
            <motion.span
              key={threatPct}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {threatPct.toFixed(1)}%
            </motion.span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.35)" }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${threatPct}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
              style={{
                height: "100%",
                background: "linear-gradient(90deg, #2dd4bf, #fbbf24, #fb923c, #fb7185)",
                borderRadius: "999px",
              }}
            />
          </div>
        </div>

        {/* Scan score pill */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
          style={{
            background: counts.CRITICAL > 0
              ? "rgba(225,29,72,0.1)"
              : counts.HIGH > 0
                ? "rgba(234,88,12,0.1)"
                : "rgba(13,148,136,0.1)",
            border: `1px solid ${counts.CRITICAL > 0 ? "rgba(225,29,72,0.25)" : counts.HIGH > 0 ? "rgba(234,88,12,0.25)" : "rgba(13,148,136,0.25)"}`,
            color: counts.CRITICAL > 0 ? "#e11d48" : counts.HIGH > 0 ? "#ea580c" : "#0d9488",
          }}
        >
          <span className="relative flex h-2 w-2">
            {counts.CRITICAL > 0 && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#e11d48" }} />
            )}
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "currentColor" }} />
          </span>
          {counts.CRITICAL > 0 ? "CRITICAL THREAT" : counts.HIGH > 0 ? "HIGH RISK" : "LOW RISK"}
        </div>
      </div>
    </motion.div>
  );
}
