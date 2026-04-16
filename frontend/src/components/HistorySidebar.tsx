"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Clock, Trash2, Shield, ShieldAlert, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AnalysisResult, AIBriefing, Severity } from "@/lib/types";

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: string;
  totalLogs: number;
  anomalyCount: number;
  severityCounts: Record<Severity, number>;
  result: AnalysisResult;
  briefing?: AIBriefing;
}

interface HistorySidebarProps {
  history: HistoryEntry[];
  activeId: string | null;
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
}

const SEV_COLORS: Record<Severity, string> = {
  CRITICAL: "#fb7185",
  HIGH:     "#fb923c",
  MEDIUM:   "#fbbf24",
  LOW:      "#2dd4bf",
};

function DiffBadge({ delta, label }: { delta: number; label: string }) {
  if (delta === 0) return (
    <span className="flex items-center gap-0.5 text-[9px] font-mono" style={{ color: "#64748b" }}>
      <Minus className="w-2 h-2" />{label}
    </span>
  );
  const up = delta > 0;
  return (
    <span
      className="flex items-center gap-0.5 text-[9px] font-bold font-mono"
      style={{ color: up ? "#fb7185" : "#4ade80" }}
    >
      {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {up ? "+" : ""}{delta} {label}
    </span>
  );
}

export function HistorySidebar({ history, activeId, onSelect, onClear }: HistorySidebarProps) {
  return (
    <div className="flex flex-col h-full gap-1">
      {/* Section header */}
      <div className="flex items-center justify-between px-2 pt-2 pb-3"
           style={{ borderBottom: "1px solid rgba(255,255,255,0.3)" }}>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" style={{ color: "#94a3b8" }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
            History
          </span>
          {history.length > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}
            >
              {history.length}
            </span>
          )}
        </div>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 transition-all duration-200 hover:opacity-80"
            style={{
              color: "#94a3b8",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.5)",
            }}
          >
            <Trash2 className="w-2.5 h-2.5" />
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
        <AnimatePresence>
          {history.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-2 py-10 text-center px-3"
            >
              <ShieldAlert className="w-7 h-7 opacity-20" style={{ color: "#64748b" }} />
              <p className="text-[11px] leading-relaxed opacity-40" style={{ color: "#64748b" }}>
                Completed analyses<br />will appear here
              </p>
            </motion.div>
          ) : (
            history.map((entry, i) => {
              const isActive = entry.id === activeId;
              const prev = history[i + 1]; // history is newest-first

              const anomalyDelta = prev ? entry.anomalyCount - prev.anomalyCount : null;
              const critDelta    = prev ? entry.severityCounts.CRITICAL - prev.severityCounts.CRITICAL : null;

              return (
                <motion.button
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 300, damping: 26 }}
                  onClick={() => onSelect(entry)}
                  className="w-full text-left"
                >
                  <div
                    className="p-2.5 rounded-2xl transition-all duration-200"
                    style={{
                      background: isActive
                        ? "rgba(124,58,237,0.08)"
                        : "rgba(255,255,255,0.25)",
                      border: isActive
                        ? "1.5px solid rgba(124,58,237,0.25)"
                        : "1px solid rgba(255,255,255,0.4)",
                      boxShadow: isActive
                        ? "0 4px 14px rgba(124,58,237,0.08), inset 0 1px 2px rgba(255,255,255,0.3)"
                        : "0 1px 4px rgba(0,0,0,0.03)",
                    }}
                  >
                    {/* Label row */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Shield className="w-3 h-3 shrink-0" style={{ color: isActive ? "#7c3aed" : "#94a3b8" }} />
                      <span
                        className="text-[11px] font-semibold truncate"
                        style={{ color: isActive ? "#1e293b" : "#475569" }}
                      >
                        {entry.label}
                      </span>
                    </div>

                    {/* Severity pills */}
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Severity[]).map((sev) => {
                        const count = entry.severityCounts[sev];
                        if (!count) return null;
                        return (
                          <span
                            key={sev}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                            style={{
                              background: SEV_COLORS[sev],
                              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                            }}
                          >
                            {count} {sev.slice(0, 4)}
                          </span>
                        );
                      })}
                    </div>

                    {/* Meta */}
                    <div className="text-[10px] font-mono mb-1.5" style={{ color: "#94a3b8" }}>
                      {entry.totalLogs.toLocaleString()} logs ·{" "}
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>

                    {/* Diff vs previous scan */}
                    {prev && anomalyDelta !== null && critDelta !== null && (
                      <div
                        className="flex items-center gap-2 pt-1.5 mt-1"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.2)" }}
                      >
                        <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "#94a3b8" }}>vs prev</span>
                        <DiffBadge delta={anomalyDelta} label="threats" />
                        {critDelta !== 0 && <DiffBadge delta={critDelta} label="crit" />}
                      </div>
                    )}
                  </div>
                </motion.button>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
