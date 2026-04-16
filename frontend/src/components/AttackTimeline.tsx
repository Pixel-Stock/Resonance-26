"use client";

import { motion } from "framer-motion";
import { Clock, ChevronRight } from "lucide-react";
import type { Anomaly, Severity } from "@/lib/types";
import { MITRE_MAP } from "@/lib/mitre";

const severityColor: Record<Severity, string> = {
  CRITICAL: "#fb7185",
  HIGH: "#fb923c",
  MEDIUM: "#fbbf24",
  LOW: "#2dd4bf",
};

const severityGlow: Record<Severity, string> = {
  CRITICAL: "rgba(251,113,133,0.5)",
  HIGH: "rgba(251,146,60,0.5)",
  MEDIUM: "rgba(251,191,36,0.5)",
  LOW: "rgba(45,212,191,0.5)",
};

function formatThreat(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface AttackTimelineProps {
  anomalies: Anomaly[];
}

export function AttackTimeline({ anomalies }: AttackTimelineProps) {
  // Sort chronologically
  const sorted = [...anomalies].sort(
    (a, b) => new Date(a.parsed_log.timestamp).getTime() - new Date(b.parsed_log.timestamp).getTime()
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.1 }}
      className="glass"
      style={{ padding: "1.25rem" }}
    >
      <div className="flex items-center gap-2 pb-3 mb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.35)" }}>
        <Clock className="w-4 h-4 text-violet-500" />
        <h2 className="text-sm uppercase font-semibold tracking-wider" style={{ color: "#1e293b" }}>
          Attack Timeline
        </h2>
        <span className="ml-auto text-xs font-mono" style={{ color: "#94a3b8" }}>
          {sorted.length} events
        </span>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div
          className="absolute left-[19px] top-0 bottom-0 w-px"
          style={{ background: "linear-gradient(to bottom, rgba(139,92,246,0.4), rgba(45,212,191,0.2))" }}
        />

        <div className="space-y-4 pl-10 max-h-[480px] overflow-y-auto pr-1">
          {sorted.map((a, i) => {
            const color = severityColor[a.severity] || severityColor.LOW;
            const glow = severityGlow[a.severity] || severityGlow.LOW;
            const mitre = MITRE_MAP[a.threat_type] || MITRE_MAP.UNKNOWN;
            const time = new Date(a.parsed_log.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07, type: "spring", stiffness: 250, damping: 22 }}
                className="relative"
              >
                {/* Timeline dot */}
                <div
                  className="absolute -left-10 top-3 w-5 h-5 rounded-full border-2 border-white/70 flex items-center justify-center"
                  style={{
                    background: color,
                    boxShadow: `0 0 10px ${glow}`,
                    zIndex: 1,
                  }}
                >
                  {i < sorted.length - 1 && (
                    <ChevronRight className="w-2.5 h-2.5 text-white" />
                  )}
                </div>

                {/* Card */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.4)",
                    borderRadius: "14px",
                    padding: "12px 14px",
                    boxShadow: `0 2px 12px rgba(0,0,0,0.04), inset 0 1px 2px rgba(255,255,255,0.05)`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-sm" style={{ color: "#1e293b" }}>
                      {formatThreat(a.threat_type)}
                    </span>
                    <span className="text-xs font-mono shrink-0" style={{ color: "#94a3b8" }}>
                      {time}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "#64748b" }}>
                    {a.parsed_log.ip && <span>IP: <span className="font-mono">{a.parsed_log.ip}</span></span>}
                    {a.parsed_log.user && <span>User: <span className="font-mono">{a.parsed_log.user}</span></span>}
                    <span
                      className="font-mono px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(255,255,255,0.05)", color, fontSize: "10px" }}
                    >
                      {mitre.techniqueId} · {mitre.tactic}
                    </span>
                  </div>

                  {/* Step connector label */}
                  {i < sorted.length - 1 && (
                    <div className="mt-2 text-[10px] font-mono flex items-center gap-1" style={{ color: "#cbd5e1" }}>
                      <span>leads to</span>
                      <ChevronRight className="w-2.5 h-2.5" />
                      <span style={{ color: severityColor[sorted[i + 1].severity] }}>
                        {formatThreat(sorted[i + 1].threat_type)}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
