"use client";

import { motion } from "framer-motion";
import { Sparkles, FileWarning, CheckCircle } from "lucide-react";
import type { AIBriefing } from "@/lib/types";

interface AIBriefingCardProps {
  briefing: AIBriefing | null;
  streamingText?: string;
  isStreaming?: boolean;
}

export function AIBriefingCard({ briefing, streamingText, isStreaming }: AIBriefingCardProps) {
  const hasBriefing = briefing && briefing.executive_summary;
  
  // Detect if the API returned an error string about quota exhaustion
  const isRateLimited = hasBriefing && 
    typeof briefing.executive_summary === 'string' &&
    (briefing.executive_summary.includes('RESOURCE_EXHAUSTED') || briefing.executive_summary.includes('quota'));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.1 }}
      className="glass relative overflow-hidden"
      style={{ padding: "1.25rem" }}
    >
      {/* Top accent bar — holographic gradient */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: "3px",
          background: "linear-gradient(90deg, #a78bfa, #5eead4, #fb7185, #fbbf24, #a78bfa)",
          backgroundSize: "200% 100%",
          borderRadius: "24px 24px 0 0",
        }}
      />

      <div className="flex items-center gap-2 pb-3 mb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.35)" }}>
        <Sparkles className="w-5 h-5 text-violet-500" />
        <h2 className="text-sm uppercase font-semibold tracking-wider" style={{ color: "#1e293b" }}>
          AI Security Briefing
        </h2>
      </div>

      {isStreaming && !hasBriefing && (
        <div className="min-h-[100px] flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-sm" style={{ color: "#64748b" }}>Generating briefing...</span>
          </div>
          {streamingText && (
            <p className="mt-3 text-xs font-mono whitespace-pre-wrap" style={{ color: "#94a3b8" }}>
              {streamingText}
            </p>
          )}
        </div>
      )}

      {hasBriefing && isRateLimited && (
        <div className="p-4 rounded-2xl bg-white/50 border border-white/60 mt-2">
          <div className="flex items-center gap-2 mb-2 text-rose-500">
            <FileWarning className="w-4 h-4" />
            <h3 className="text-sm font-bold uppercase tracking-wider">API Quota Exhausted</h3>
          </div>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "#475569" }}>
            The Gemini API key configured in the environment has reached its free tier rate limit. 
            The system successfully scanned logs using local ML models, but the secondary AI executive briefing could not be generated.
          </p>
          <div className="text-xs font-mono p-3 rounded-xl overflow-x-auto" style={{ color: "#64748b", background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.5)" }}>
            {typeof briefing.executive_summary === 'string' ? briefing.executive_summary.substring(0, 150) + "..." : "Error"}
          </div>
        </div>
      )}

      {hasBriefing && !isRateLimited && (
        <div className="space-y-5">
          {/* Executive Summary */}
          <div>
            <h3 className="text-xs uppercase font-semibold tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "#7c3aed" }}>
              <FileWarning className="w-3.5 h-3.5" />
              Executive Summary
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>
              {briefing.executive_summary}
            </p>
          </div>

          {/* Technical Details — in a nested glass card */}
          <div>
            <h3 className="text-xs uppercase font-semibold tracking-wider mb-2" style={{ color: "#7c3aed" }}>
              Technical Details
            </h3>
            <div
              className="text-sm leading-relaxed font-mono"
              style={{
                color: "#475569",
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: "14px",
                padding: "0.875rem",
                boxShadow: "inset 0 1px 3px rgba(255,255,255,0.6)",
              }}
            >
              {briefing.technical_details}
            </div>
          </div>

          {/* Remediation Steps */}
          {briefing.remediation_steps.length > 0 && (
            <div>
              <h3 className="text-xs uppercase font-semibold tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "#7c3aed" }}>
                <CheckCircle className="w-3.5 h-3.5" />
                Remediation Steps
              </h3>
              <ul className="space-y-2.5">
                {briefing.remediation_steps.map((step, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="text-sm flex gap-2.5"
                    style={{ color: "#475569" }}
                  >
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{
                        background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                        boxShadow: "0 2px 4px rgba(124,58,237,0.25)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
