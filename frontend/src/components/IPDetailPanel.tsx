"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, User, ShieldAlert, TrendingUp, ChevronRight } from "lucide-react";
import type { Anomaly, Severity } from "@/lib/types";
import { MITRE_MAP } from "@/lib/mitre";
import { getVPNLabel } from "@/lib/vpnIPs";

const SEV_COLOR: Record<Severity, string> = {
  CRITICAL: "#fb7185",
  HIGH:     "#fb923c",
  MEDIUM:   "#fbbf24",
  LOW:      "#2dd4bf",
};
const SEV_BG: Record<Severity, string> = {
  CRITICAL: "rgba(251,113,133,0.1)",
  HIGH:     "rgba(251,146,60,0.1)",
  MEDIUM:   "rgba(251,191,36,0.08)",
  LOW:      "rgba(45,212,191,0.08)",
};

function formatThreat(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function fmtTime(ts: string) {
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return ts; }
}
function fmtDate(ts: string) {
  try { return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); }
  catch { return ts; }
}

// Detect escalation chains within the IP's event set
const ESCALATION_CHAINS: [string, string][] = [
  ["BRUTE_FORCE",    "ACCOUNT_COMPROMISE"],
  ["BRUTE_FORCE",    "EXTERNAL_ACCESS"],
  ["EXTERNAL_ACCESS","LATERAL_MOVEMENT"],
  ["EXTERNAL_ACCESS","PRIVILEGE_ESCALATION"],
  ["LATERAL_MOVEMENT","PERSISTENCE"],
];

interface IPDetailPanelProps {
  ip: string;
  allAnomalies: Anomaly[];
  onClose: () => void;
}

export function IPDetailPanel({ ip, allAnomalies, onClose }: IPDetailPanelProps) {
  // All anomalies involving this IP
  const events = allAnomalies
    .filter(a => a.parsed_log.ip === ip)
    .sort((a, b) => new Date(a.parsed_log.timestamp).getTime() - new Date(b.parsed_log.timestamp).getTime());

  const vpnLabel = getVPNLabel(ip);

  // Stats
  const uniqueUsers  = [...new Set(events.map(a => a.parsed_log.user).filter(Boolean))];
  const uniqueTypes  = [...new Set(events.map(a => a.threat_type))];
  const worstSev     = (["CRITICAL","HIGH","MEDIUM","LOW"] as Severity[]).find(s => events.some(a => a.severity === s)) ?? "LOW";
  const firstSeen    = events[0]?.parsed_log.timestamp;
  const lastSeen     = events[events.length - 1]?.parsed_log.timestamp;
  const totalAttempts = events.reduce((sum, a) => {
    const match = a.attack_chain?.[0]?.match(/(\d+)\s+failed/i);
    return sum + (match ? parseInt(match[1]) : 1);
  }, 0);

  // Escalation detection
  const typeSet = new Set(events.map(a => a.threat_type));
  const escalations = ESCALATION_CHAINS.filter(([from, to]) => typeSet.has(from) && typeSet.has(to));

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
        }}
      />

      {/* Panel */}
      <motion.div
        key="panel"
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 60 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        style={{
          position: "fixed",
          top: 24, right: 24, bottom: 24,
          width: 420,
          zIndex: 51,
          borderRadius: 20,
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border: "1.5px solid rgba(255,255,255,0.6)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.12), inset 0 1px 2px rgba(255,255,255,0.8)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.4)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                IP Attack History
              </p>
              <p style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#1e293b", letterSpacing: "-0.02em" }}>
                {ip}
              </p>
              {vpnLabel && (
                <span style={{
                  display: "inline-block", marginTop: 4,
                  fontSize: 10, fontWeight: 700,
                  padding: "2px 8px", borderRadius: 999,
                  background: "rgba(251,191,36,0.15)",
                  border: "1px solid rgba(251,191,36,0.35)",
                  color: "#b45309",
                }}>
                  🔒 {vpnLabel}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(0,0,0,0.06)", border: "none",
                borderRadius: 8, padding: 6, cursor: "pointer",
                display: "flex", color: "#64748b",
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stat row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
            {[
              { label: "Total Events", value: events.length },
              { label: "Auth Attempts", value: totalAttempts.toLocaleString() },
              { label: "Users Targeted", value: uniqueUsers.length },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.6)",
                borderRadius: 10, padding: "8px 10px",
              }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: SEV_COLOR[worstSev], margin: 0 }}>{value}</p>
                <p style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 20px" }}>

          {/* Escalation alert */}
          {escalations.length > 0 && (
            <div style={{
              marginBottom: 14, padding: "10px 12px", borderRadius: 12,
              background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.25)",
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#e11d48", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                ⚠ Attack Escalation Detected
              </p>
              {escalations.map(([from, to]) => (
                <div key={`${from}-${to}`} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#475569" }}>
                  <span style={{ fontWeight: 600, color: "#fb7185" }}>{formatThreat(from)}</span>
                  <ChevronRight className="w-3 h-3" style={{ color: "#fb7185" }} />
                  <span style={{ fontWeight: 600, color: "#e11d48" }}>{formatThreat(to)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Time window */}
          {firstSeen && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 11, color: "#64748b" }}>
              <Clock className="w-3.5 h-3.5" />
              <span>{fmtDate(firstSeen)} · {fmtTime(firstSeen)}</span>
              {firstSeen !== lastSeen && (
                <>
                  <span>→</span>
                  <span>{fmtTime(lastSeen!)}</span>
                </>
              )}
            </div>
          )}

          {/* Users targeted */}
          {uniqueUsers.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <User className="w-3 h-3" /> Users Targeted
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {uniqueUsers.map(u => (
                  <span key={u} style={{
                    fontFamily: "monospace", fontSize: 11, padding: "3px 10px",
                    borderRadius: 999, fontWeight: 600,
                    background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#7c3aed",
                  }}>{u}</span>
                ))}
              </div>
            </div>
          )}

          {/* Attack types */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
              <ShieldAlert className="w-3 h-3" /> Attack Types
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {uniqueTypes.map(t => {
                const sev = events.find(a => a.threat_type === t)?.severity ?? "LOW";
                return (
                  <span key={t} style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                    background: SEV_BG[sev], border: `1px solid ${SEV_COLOR[sev]}33`, color: SEV_COLOR[sev],
                  }}>{formatThreat(t)}</span>
                );
              })}
            </div>
          </div>

          {/* Full event timeline */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}>
              <TrendingUp className="w-3 h-3" /> Full Event Timeline
            </p>

            <div style={{ position: "relative" }}>
              {/* Vertical line */}
              <div style={{
                position: "absolute", left: 9, top: 0, bottom: 0, width: 1,
                background: "linear-gradient(to bottom, rgba(124,58,237,0.3), rgba(45,212,191,0.1))",
              }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 28 }}>
                {events.map((a, i) => {
                  const mitre = MITRE_MAP[a.threat_type] || MITRE_MAP.UNKNOWN;
                  return (
                    <motion.div
                      key={`${a.id}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{ position: "relative" }}
                    >
                      {/* Dot */}
                      <div style={{
                        position: "absolute", left: -22, top: 8,
                        width: 10, height: 10, borderRadius: "50%",
                        background: SEV_COLOR[a.severity],
                        boxShadow: `0 0 6px ${SEV_COLOR[a.severity]}88`,
                        border: "1.5px solid rgba(255,255,255,0.7)",
                      }} />

                      <div style={{
                        background: "rgba(255,255,255,0.5)",
                        border: "1px solid rgba(255,255,255,0.6)",
                        borderRadius: 10, padding: "8px 10px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>
                            {formatThreat(a.threat_type)}
                          </span>
                          <span style={{ fontSize: 10, fontFamily: "monospace", color: "#94a3b8", flexShrink: 0, marginLeft: 8 }}>
                            {fmtTime(a.parsed_log.timestamp)}
                          </span>
                        </div>
                        {a.parsed_log.user && (
                          <p style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b", margin: 0 }}>
                            user: {a.parsed_log.user}
                          </p>
                        )}
                        {a.attack_chain?.[0] && (
                          <p style={{ fontSize: 10, color: SEV_COLOR[a.severity], margin: "3px 0 0", fontWeight: 600 }}>
                            › {a.attack_chain[0]}
                          </p>
                        )}
                        <span style={{
                          display: "inline-block", marginTop: 4,
                          fontSize: 9, fontFamily: "monospace",
                          padding: "1px 6px", borderRadius: 4,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: SEV_COLOR[a.severity],
                        }}>
                          {mitre.techniqueId} · {mitre.tactic}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
