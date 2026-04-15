"use client";

import { motion } from "framer-motion";
import type { Anomaly, Severity } from "@/lib/types";
import { MITRE_MAP } from "@/lib/mitre";
import { ShieldAlert, ShieldX, AlertTriangle, Info, ExternalLink } from "lucide-react";

const severityClass: Record<Severity, string> = {
  CRITICAL: "glass-critical",
  HIGH: "glass-high",
  MEDIUM: "glass-medium",
  LOW: "glass-low",
};

const badgeColors: Record<Severity, { bg: string; text: string }> = {
  CRITICAL: { bg: "linear-gradient(135deg, #fb7185, #e11d48)", text: "#fff" },
  HIGH: { bg: "linear-gradient(135deg, #fb923c, #ea580c)", text: "#fff" },
  MEDIUM: { bg: "linear-gradient(135deg, #fbbf24, #d97706)", text: "#fff" },
  LOW: { bg: "linear-gradient(135deg, #2dd4bf, #0d9488)", text: "#fff" },
};

const severityIcon: Record<Severity, React.ReactNode> = {
  CRITICAL: <ShieldX className="w-4 h-4" />,
  HIGH: <ShieldAlert className="w-4 h-4" />,
  MEDIUM: <AlertTriangle className="w-4 h-4" />,
  LOW: <Info className="w-4 h-4" />,
};

function formatThreat(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface AnomalyListProps {
  anomalies: Anomaly[];
}

export function AnomalyList({ anomalies }: AnomalyListProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className="glass"
      style={{ padding: "1.25rem" }}
    >
      <div className="flex items-center gap-2 pb-3 mb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.35)" }}>
        <ShieldAlert className="w-4 h-4 text-violet-500" />
        <h2 className="text-sm uppercase font-semibold tracking-wider" style={{ color: "#1e293b" }}>
          Detected Threats
        </h2>
        <span className="ml-auto text-xs font-mono" style={{ color: "#94a3b8" }}>
          {anomalies.length} found
        </span>
      </div>

      <div className="flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
        {anomalies.map((a, i) => {
          const mitre = MITRE_MAP[a.threat_type] || MITRE_MAP.UNKNOWN;
          
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 250, damping: 20 }}
              className={`${severityClass[a.severity]} p-4 cursor-pointer`}
              whileHover={{ scale: 1.015, y: -1 }}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {severityIcon[a.severity]}
                    <span className="font-semibold text-sm" style={{ color: "#1e293b" }}>{formatThreat(a.threat_type)}</span>
                  </div>
                  {/* Correlated Rule Tags */}
                  {(a.threat_score > 0 || (a.attack_chain && a.attack_chain.length > 0)) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {a.threat_score > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "rgba(255,255,255,0.4)", border: "1px solid rgba(0,0,0,0.1)", color: "#1e293b" }}>
                          Score: +{a.threat_score}
                        </span>
                      )}
                      {a.attack_chain && a.attack_chain.map(rule => (
                        <span key={rule} className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.2)", color: "#e11d48" }}>
                          {rule}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <span
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{
                    background: badgeColors[a.severity].bg,
                    color: badgeColors[a.severity].text,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.3)",
                  }}
                >
                  {a.severity}
                </span>
              </div>

              <div className="mt-2.5 space-y-1 text-[#475569]">
                {a.parsed_log.ip && (
                  <p className="text-xs font-mono opacity-75">IP: {a.parsed_log.ip}</p>
                )}
                {a.parsed_log.user && (
                  <p className="text-xs font-mono opacity-75">User: {a.parsed_log.user}</p>
                )}
                <p
                  className="text-xs font-mono truncate mt-1.5 px-2.5 py-1.5 rounded-lg text-[#1e293b]"
                  style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.5)" }}
                >
                  {a.parsed_log.raw.slice(0, 120)}
                </p>
              </div>

              {/* MITRE ATT&CK badge */}
              <a
                href={mitre.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-[10px] font-mono px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity"
                style={{
                  background: "rgba(255,255,255,0.3)",
                  border: "1px solid rgba(255,255,255,0.4)",
                  color: "#475569",
                  textDecoration: "none",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="font-bold text-[#1e293b]">MITRE</span>
                <span className="opacity-60">·</span>
                <span>{mitre.techniqueId}</span>
                <span className="opacity-60">·</span>
                <span>{mitre.tactic}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-50" />
              </a>

            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
