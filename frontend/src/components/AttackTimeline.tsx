"use client";

import { motion } from "framer-motion";
import { Clock, ChevronRight, ShieldAlert, Info } from "lucide-react";
import { useState } from "react";
import type { Anomaly, Severity } from "@/lib/types";
import { MITRE_MAP } from "@/lib/mitre";
import { THREAT_DESCRIPTIONS } from "@/lib/threatExplanations";
import { getVPNLabel } from "@/lib/vpnIPs";

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
  onIPClick?: (ip: string) => void;
}

export function AttackTimeline({ anomalies, onIPClick }: AttackTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...anomalies].sort(
    (a, b) =>
      new Date(a.parsed_log.timestamp).getTime() -
      new Date(b.parsed_log.timestamp).getTime()
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.1 }}
      className="glass"
      style={{ padding: "1.25rem" }}
    >
      <div
        className="flex items-center gap-2 pb-3 mb-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <Clock className="w-4 h-4" style={{ color: "#818cf8" }} />
        <h2
          className="text-sm uppercase font-semibold tracking-wider"
          style={{ color: "#e2e8f0" }}
        >
          Attack Timeline
        </h2>
        <span className="ml-auto text-xs font-mono" style={{ color: "#64748b" }}>
          {sorted.length} events
        </span>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div
          className="absolute left-[19px] top-0 bottom-0 w-px"
          style={{
            background:
              "linear-gradient(to bottom, rgba(129,140,248,0.4), rgba(45,212,191,0.15))",
          }}
        />

        <div className="space-y-4 pl-10 max-h-[520px] overflow-y-auto pr-1">
          {sorted.map((a, i) => {
            const color = severityColor[a.severity] || severityColor.LOW;
            const glow = severityGlow[a.severity] || severityGlow.LOW;
            const mitre = MITRE_MAP[a.threat_type] || MITRE_MAP.UNKNOWN;
            const explanation =
              THREAT_DESCRIPTIONS[a.threat_type] || THREAT_DESCRIPTIONS.UNKNOWN;
            const vpnLabel = getVPNLabel(a.parsed_log.ip);
            const cardKey = `${a.id}-${i}`;
            const isExpanded = expandedId === cardKey;
            const time = new Date(a.parsed_log.timestamp).toLocaleTimeString(
              [],
              { hour: "2-digit", minute: "2-digit", second: "2-digit" }
            );

            return (
              <motion.div
                key={cardKey}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: i * 0.07,
                  type: "spring",
                  stiffness: 250,
                  damping: 22,
                }}
                className="relative"
              >
                {/* Timeline dot */}
                <div
                  className="absolute -left-10 top-3 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{
                    background: color,
                    borderColor: "rgba(255,255,255,0.15)",
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
                    background: isExpanded
                      ? "rgba(30,41,59,0.7)"
                      : "rgba(30,41,59,0.4)",
                    border: `1px solid ${
                      isExpanded ? color : "rgba(255,255,255,0.08)"
                    }`,
                    borderRadius: "14px",
                    padding: "12px 14px",
                    boxShadow: isExpanded
                      ? `0 2px 20px ${glow}, inset 0 1px 0 rgba(255,255,255,0.04)`
                      : "0 2px 8px rgba(0,0,0,0.2)",
                    transition: "border 0.2s, box-shadow 0.2s, background 0.2s",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : cardKey)}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="font-semibold text-sm"
                        style={{ color: "#e2e8f0" }}
                      >
                        {formatThreat(a.threat_type)}
                      </span>
                      <span
                        className="text-[11px] font-medium"
                        style={{ color }}
                      >
                        {explanation.diagnostic}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-xs font-mono"
                        style={{ color: "#64748b" }}
                      >
                        {time}
                      </span>
                      <Info
                        className="w-3.5 h-3.5"
                        style={{
                          color: isExpanded ? color : "#475569",
                          transition: "color 0.2s",
                        }}
                      />
                    </div>
                  </div>

                  {/* IP / User / MITRE */}
                  <div
                    className="flex flex-wrap gap-x-3 gap-y-1 text-xs"
                    style={{ color: "#64748b" }}
                  >
                    {a.parsed_log.ip && (
                      <span className="flex items-center gap-1">
                        IP:{" "}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onIPClick?.(a.parsed_log.ip);
                          }}
                          className="font-mono hover:underline transition-opacity hover:opacity-80"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            color: "inherit",
                            textDecoration: "underline dotted",
                          }}
                        >
                          {a.parsed_log.ip}
                        </button>
                        {vpnLabel && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                            style={{
                              background: "rgba(251,191,36,0.15)",
                              color: "#b45309",
                              border: "1px solid rgba(251,191,36,0.3)",
                            }}
                          >
                            🔒 {vpnLabel}
                          </span>
                        )}
                      </span>
                    )}
                    {a.parsed_log.user && (
                      <span>
                        User:{" "}
                        <span className="font-mono">{a.parsed_log.user}</span>
                      </span>
                    )}
                    <a
                      href={mitre.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
                      style={{
                        background: "rgba(129,140,248,0.08)",
                        color,
                        fontSize: "10px",
                        textDecoration: "none",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {mitre.techniqueId} · {mitre.tactic}
                    </a>
                  </div>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div
                        className="mt-3 p-3 rounded-xl text-[11px] leading-relaxed"
                        style={{
                          background: "rgba(15,23,42,0.5)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          color: "#94a3b8",
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <ShieldAlert
                            className="w-3 h-3"
                            style={{ color }}
                          />
                          <span
                            className="font-bold uppercase text-[9px] tracking-wider"
                            style={{ color }}
                          >
                            What&apos;s Happening
                          </span>
                        </div>
                        {explanation.techDetail}
                      </div>

                      {a.attack_chain && a.attack_chain.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1">
                          {a.attack_chain.map((rule, ri) => (
                            <div
                              key={ri}
                              className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg"
                              style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.07)",
                                color: "#64748b",
                              }}
                            >
                              <span style={{ color }} className="mr-1">
                                ›
                              </span>
                              {rule}
                            </div>
                          ))}
                        </div>
                      )}

                      {a.threat_score > 0 && (
                        <div
                          className="mt-2 flex items-center gap-2 text-[10px]"
                          style={{ color: "#64748b" }}
                        >
                          <span
                            className="font-mono px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(255,255,255,0.04)" }}
                          >
                            Threat Score: {a.threat_score}/10
                          </span>
                          <span
                            className="font-mono px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(255,255,255,0.04)" }}
                          >
                            IF Score: {a.isolation_score.toFixed(3)}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Step connector */}
                  {i < sorted.length - 1 && !isExpanded && (
                    <div
                      className="mt-2 text-[10px] font-mono flex items-center gap-1"
                      style={{ color: "#475569" }}
                    >
                      <span>leads to</span>
                      <ChevronRight className="w-2.5 h-2.5" />
                      <span
                        style={{
                          color: severityColor[sorted[i + 1].severity],
                        }}
                      >
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
