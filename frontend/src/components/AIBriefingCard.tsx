"use client";

import { motion } from "framer-motion";
import {
  Sparkles,
  FileWarning,
  CheckCircle,
  AlertTriangle,
  Shield,
} from "lucide-react";
import type { AIBriefing } from "@/lib/types";

interface AIBriefingCardProps {
  briefing: AIBriefing | null;
  streamingText?: string;
  isStreaming?: boolean;
}

export function AIBriefingCard({
  briefing,
  streamingText,
  isStreaming,
}: AIBriefingCardProps) {
  const hasBriefing = briefing && briefing.executive_summary;

  const isRateLimited =
    hasBriefing &&
    typeof briefing.executive_summary === "string" &&
    (briefing.executive_summary.includes("RESOURCE_EXHAUSTED") ||
      briefing.executive_summary.includes("quota"));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.1 }}
      style={{
        background: "rgba(15,23,42,0.6)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "1.25rem",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 pb-3 mb-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Sparkles className="w-4 h-4" style={{ color: "#818cf8" }} />
        <h2
          className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: "#94a3b8" }}
        >
          AI Security Briefing
        </h2>
        {hasBriefing && !isRateLimited && (
          <span
            className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(129,140,248,0.08)",
              color: "#64748b",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            Groq · llama-3.3-70b
          </span>
        )}
      </div>

      {/* Streaming state */}
      {isStreaming && !hasBriefing && (
        <div className="min-h-[80px] flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "#818cf8" }}
            />
            <span className="text-xs font-medium" style={{ color: "#64748b" }}>
              Generating briefing…
            </span>
          </div>
          {streamingText && (
            <pre
              className="text-xs font-mono whitespace-pre-wrap leading-relaxed"
              style={{
                color: "#64748b",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 8,
                padding: "0.75rem",
              }}
            >
              {streamingText}
            </pre>
          )}
        </div>
      )}

      {/* Rate limit error */}
      {hasBriefing && isRateLimited && (
        <div
          className="p-4 rounded-xl mt-2"
          style={{
            background: "rgba(251,113,133,0.05)",
            border: "1px solid rgba(251,113,133,0.12)",
          }}
        >
          <div className="flex items-center gap-2 mb-2" style={{ color: "#fb7185" }}>
            <FileWarning className="w-4 h-4" />
            <h3 className="text-xs font-semibold">API Quota Exhausted</h3>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>
            The Groq API key has reached its rate limit. Log analysis completed
            successfully — only the AI narrative is unavailable.
          </p>
        </div>
      )}

      {/* Full briefing */}
      {hasBriefing && !isRateLimited && (
        <div className="space-y-5">

          {/* Executive Summary */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3.5 h-3.5" style={{ color: "#818cf8" }} />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                Executive Summary
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>
              {briefing.executive_summary}
            </p>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

          {/* Technical Details */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#64748b" }} />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                Technical Analysis
              </h3>
            </div>
            <div
              className="text-xs leading-relaxed rounded-lg p-3"
              style={{
                color: "#94a3b8",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                fontFamily: "var(--font-mono, monospace)",
                lineHeight: 1.8,
              }}
            >
              {briefing.technical_details
                .split(/(?<=\. )/)
                .map((sentence, i) => (
                  <span key={i}>
                    {sentence.trim().length > 0 && (
                      <span className="inline-block">
                        {sentence
                          .split(
                            /(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\b[A-Z_]{4,}\b|`[^`]+`)/
                          )
                          .map((part, j) => {
                            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(part)) {
                              return (
                                <span key={j} style={{ color: "#fb7185", fontWeight: 600 }}>
                                  {part}
                                </span>
                              );
                            }
                            if (/^`[^`]+`$/.test(part)) {
                              return (
                                <span key={j} style={{ color: "#818cf8" }}>
                                  {part.slice(1, -1)}
                                </span>
                              );
                            }
                            return <span key={j}>{part}</span>;
                          })}
                      </span>
                    )}
                  </span>
                ))}
            </div>
          </div>

          {/* Remediation Steps */}
          {briefing.remediation_steps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-3.5 h-3.5" style={{ color: "#2dd4bf" }} />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                  Remediation Steps
                </h3>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(45,212,191,0.08)", color: "#2dd4bf" }}
                >
                  {briefing.remediation_steps.length}
                </span>
              </div>
              <div className="space-y-2">
                {briefing.remediation_steps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex gap-3 items-start"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: "rgba(129,140,248,0.12)",
                        color: "#818cf8",
                        border: "1px solid rgba(129,140,248,0.2)",
                        marginTop: 1,
                      }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 text-xs" style={{ color: "#94a3b8", lineHeight: 1.6 }}>
                      {step.split(/(`[^`]+`)/).map((part, j) =>
                        part.startsWith("`") ? (
                          <code
                            key={j}
                            className="text-[11px] rounded px-1"
                            style={{
                              background: "rgba(129,140,248,0.08)",
                              color: "#818cf8",
                              fontFamily: "monospace",
                            }}
                          >
                            {part.slice(1, -1)}
                          </code>
                        ) : (
                          <span key={j}>{part}</span>
                        )
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
