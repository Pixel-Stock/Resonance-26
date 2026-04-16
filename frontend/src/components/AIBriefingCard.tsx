"use client";

import { motion } from "framer-motion";
import {
  Sparkles,
  FileWarning,
  CheckCircle,
  AlertTriangle,
  Shield,
  ChevronRight,
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
      className="glass relative overflow-hidden"
      style={{ padding: "1.25rem" }}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: "2px",
          background:
            "linear-gradient(90deg, #818cf8, #5eead4, #fb7185, #fbbf24, #818cf8)",
          backgroundSize: "200% 100%",
          borderRadius: "24px 24px 0 0",
        }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 pb-3 mb-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <Sparkles className="w-5 h-5" style={{ color: "#818cf8" }} />
        <h2
          className="text-sm uppercase font-semibold tracking-wider"
          style={{ color: "#e2e8f0" }}
        >
          AI Security Briefing
        </h2>
        {hasBriefing && !isRateLimited && (
          <span
            className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(129,140,248,0.12)",
              color: "#818cf8",
              border: "1px solid rgba(129,140,248,0.2)",
            }}
          >
            Groq · llama-3.3-70b
          </span>
        )}
      </div>

      {/* Streaming state */}
      {isStreaming && !hasBriefing && (
        <div className="min-h-[100px] flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: "#818cf8" }}
            />
            <span className="text-sm font-medium" style={{ color: "#94a3b8" }}>
              Generating SOC briefing…
            </span>
          </div>
          {streamingText && (
            <pre
              className="text-xs font-mono whitespace-pre-wrap leading-relaxed"
              style={{
                color: "#94a3b8",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
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
          className="p-4 rounded-2xl mt-2"
          style={{
            background: "rgba(251,113,133,0.06)",
            border: "1px solid rgba(251,113,133,0.15)",
          }}
        >
          <div
            className="flex items-center gap-2 mb-2"
            style={{ color: "#fb7185" }}
          >
            <FileWarning className="w-4 h-4" />
            <h3 className="text-sm font-bold uppercase tracking-wider">
              API Quota Exhausted
            </h3>
          </div>
          <p
            className="text-sm leading-relaxed mb-3"
            style={{ color: "#94a3b8" }}
          >
            The Groq API key has reached its rate limit. Log analysis completed
            successfully via local ML models — only the AI narrative summary is
            unavailable.
          </p>
          <div
            className="text-xs font-mono p-3 rounded-xl overflow-x-auto"
            style={{
              color: "#64748b",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {typeof briefing.executive_summary === "string"
              ? briefing.executive_summary.substring(0, 150) + "…"
              : "Error"}
          </div>
        </div>
      )}

      {/* Full briefing */}
      {hasBriefing && !isRateLimited && (
        <div className="space-y-5">

          {/* Executive Summary */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(129,140,248,0.07)",
              border: "1px solid rgba(129,140,248,0.18)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #818cf8, #6366f1)",
                }}
              >
                <Shield className="w-3 h-3 text-white" />
              </div>
              <h3
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "#818cf8" }}
              >
                Executive Summary
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>
              {briefing.executive_summary}
            </p>
          </div>

          {/* Technical Details */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(251,113,133,0.12)",
                  border: "1px solid rgba(251,113,133,0.2)",
                }}
              >
                <AlertTriangle className="w-3 h-3" style={{ color: "#fb7185" }} />
              </div>
              <h3
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "#818cf8" }}
              >
                Technical Analysis
              </h3>
            </div>
            <div
              className="text-sm leading-relaxed rounded-xl p-4"
              style={{
                color: "#94a3b8",
                background: "rgba(15,23,42,0.5)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.78rem",
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
                            if (
                              /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(part)
                            ) {
                              return (
                                <span
                                  key={j}
                                  style={{
                                    color: "#fb7185",
                                    fontWeight: 600,
                                    background: "rgba(251,113,133,0.1)",
                                    padding: "0 3px",
                                    borderRadius: 3,
                                  }}
                                >
                                  {part}
                                </span>
                              );
                            }
                            if (/^`[^`]+`$/.test(part)) {
                              return (
                                <span
                                  key={j}
                                  style={{
                                    color: "#818cf8",
                                    background: "rgba(129,140,248,0.1)",
                                    padding: "0 3px",
                                    borderRadius: 3,
                                  }}
                                >
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
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{
                    background: "rgba(45,212,191,0.12)",
                    border: "1px solid rgba(45,212,191,0.2)",
                  }}
                >
                  <CheckCircle
                    className="w-3 h-3"
                    style={{ color: "#2dd4bf" }}
                  />
                </div>
                <h3
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: "#818cf8" }}
                >
                  Remediation Steps
                </h3>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: "rgba(45,212,191,0.1)",
                    color: "#2dd4bf",
                  }}
                >
                  {briefing.remediation_steps.length} actions
                </span>
              </div>
              <div className="space-y-2">
                {briefing.remediation_steps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="flex gap-3 items-start p-3 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{
                        background:
                          i === 0
                            ? "linear-gradient(135deg, #fb7185, #e11d48)"
                            : i === 1
                            ? "linear-gradient(135deg, #fb923c, #ea580c)"
                            : "linear-gradient(135deg, #818cf8, #6366f1)",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                        marginTop: 1,
                      }}
                    >
                      {i + 1}
                    </span>
                    <div
                      className="flex-1 text-sm"
                      style={{ color: "#cbd5e1", lineHeight: 1.6 }}
                    >
                      {step.split(/(`[^`]+`)/).map((part, j) =>
                        part.startsWith("`") ? (
                          <code
                            key={j}
                            className="text-xs rounded px-1 py-0.5"
                            style={{
                              background: "rgba(129,140,248,0.12)",
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
                    <ChevronRight
                      className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                      style={{ color: "#475569" }}
                    />
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
