"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Anomaly, Severity } from "@/lib/types";

const LEVELS: { severity: Severity; color: string; label: string }[] = [
  { severity: "CRITICAL", color: "#fb7185", label: "Critical" },
  { severity: "HIGH",     color: "#fb923c", label: "High"     },
  { severity: "MEDIUM",   color: "#fbbf24", label: "Medium"   },
  { severity: "LOW",      color: "#2dd4bf", label: "Low"      },
];

function useCountUp(target: number, duration = 600): number {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = val;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (target - from) * ease));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return val;
}

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
    <span style={{ fontSize: "0.68rem", color: "#475569", fontFamily: "monospace" }}>
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

  const threatPct = Math.min(
    counts.CRITICAL * 15 + counts.HIGH * 8 + counts.MEDIUM * 3 + counts.LOW * 1,
    100
  );

  const statusLabel =
    counts.CRITICAL > 0 ? "Critical threat" :
    counts.HIGH > 0     ? "High risk" :
    "Low risk";

  const statusColor =
    counts.CRITICAL > 0 ? "#fb7185" :
    counts.HIGH > 0     ? "#fb923c" :
    "#2dd4bf";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 250, damping: 22 }}
      style={{
        background: "rgba(15,23,42,0.6)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        padding: "0.875rem 1.25rem",
      }}
    >
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {/* Total logs */}
        <div
          className="flex items-baseline gap-2 pr-4 sm:pr-6"
          style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}
        >
          <span className="text-xl font-bold tabular-nums" style={{ color: "#e2e8f0" }}>
            {animatedTotal.toLocaleString()}
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] font-medium" style={{ color: "#64748b" }}>
              logs parsed
            </span>
            <LastUpdated />
          </div>
        </div>

        {/* Severity counts */}
        {LEVELS.map((l) => {
          const count = counts[l.severity];
          return (
            <div key={l.severity} className="flex items-center gap-1.5">
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: count > 0 ? l.color : "#334155" }}
              >
                {count}
              </span>
              <span className="text-xs hidden sm:block" style={{ color: "#475569" }}>
                {l.label}
              </span>
            </div>
          );
        })}

        {/* Threat bar */}
        <div className="flex-1 min-w-[140px] hidden md:block">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px]" style={{ color: "#475569" }}>Threat level</span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: statusColor }}>
              {threatPct.toFixed(0)}%
            </span>
          </div>
          <div
            className="h-1 w-full overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${threatPct}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
              style={{
                height: "100%",
                background: statusColor,
                borderRadius: 999,
                opacity: 0.8,
              }}
            />
          </div>
        </div>

        {/* Status */}
        <div
          className="hidden lg:flex items-center gap-1.5 text-[11px] font-medium"
          style={{ color: statusColor }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: statusColor }}
          />
          {statusLabel}
        </div>
      </div>
    </motion.div>
  );
}
