"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  RotateCcw, Radio, Shield, WifiOff, Download, ShieldOff,
  LayoutDashboard, Upload, Activity, History, Zap, Brain, Bell,
  FileText, CheckCircle, ShieldAlert, X, Sparkles, Mail, Send, Loader2,
} from "lucide-react";
import { downloadPDFReport, generatePDFBase64 } from "@/lib/generateReport";
import { downloadBlocklist } from "@/lib/generateBlocklist";

import { UploadZone } from "@/components/UploadZone";
import { ScanAnimation } from "@/components/ScanAnimation";
import { AnomalyList } from "@/components/AnomalyList";
import { AIBriefingCard } from "@/components/AIBriefingCard";
import { MetricsChart } from "@/components/MetricsChart";
import { ThreatMap } from "@/components/ThreatMap";
import { AttackTimeline } from "@/components/AttackTimeline";
import { SeverityBar } from "@/components/SeverityBar";
import { HistorySidebar, type HistoryEntry } from "@/components/HistorySidebar";
import { IPDetailPanel } from "@/components/IPDetailPanel";
import { FollowUpChat } from "@/components/FollowUpChat";
import { analyzeLog } from "@/lib/api";
import { sendEmailAlert } from "@/lib/emailRelay";
import type { AnalysisState, AnalysisResult, Anomaly, Severity } from "@/lib/types";

const TOP_N = 10;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type NavItem = "dashboard" | "upload" | "monitor" | "history";

/* ── Live Monitor Strip — always visible at top of dashboard ── */
function LiveMonitorStrip({
  anomalies,
  alertsFired,
  isConnected,
  onStop,
}: {
  anomalies: Anomaly[];
  alertsFired: number;
  isConnected: boolean;
  onStop: () => void;
}) {
  const targetUrl = anomalies.find((a) => a.target_url)?.target_url || "";
  const critCount = anomalies.filter((a) => a.severity === "CRITICAL").length;
  const highCount = anomalies.filter((a) => a.severity === "HIGH").length;
  const medCount = anomalies.filter((a) => a.severity === "MEDIUM").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full mb-4"
      style={{
        background: "rgba(15, 23, 42, 0.7)",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: 16,
        padding: "14px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated glow border */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 16,
          background: `linear-gradient(90deg, transparent, rgba(239,68,68,0.06), transparent)`,
          animation: "shimmer 3s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Left: LIVE indicator + target */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: isConnected ? "#ef4444" : "#64748b" }}
              />
              <span
                className="relative inline-flex rounded-full h-3 w-3"
                style={{ background: isConnected ? "#ef4444" : "#64748b" }}
              />
            </span>
            <span
              className="text-sm font-bold tracking-wider"
              style={{ color: isConnected ? "#ef4444" : "#64748b" }}
            >
              {isConnected ? "LIVE" : "CONNECTING"}
            </span>
          </div>

          {targetUrl && (
            <span
              className="text-xs font-mono px-2.5 py-1 rounded-lg flex items-center gap-1.5"
              style={{
                background: "rgba(99, 102, 241, 0.1)",
                border: "1px solid rgba(129, 140, 248, 0.2)",
                color: "#818cf8",
              }}
            >
              <span style={{ fontSize: 10, opacity: 0.7 }}>TARGET</span>
              {(() => {
                try {
                  return new URL(
                    targetUrl.startsWith("http") ? targetUrl : "https://" + targetUrl
                  ).hostname;
                } catch {
                  return targetUrl;
                }
              })()}
            </span>
          )}
        </div>

        {/* Center: Threat counts */}
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold tabular-nums px-3 py-1 rounded-full"
            style={{
              background: anomalies.length > 0 ? "rgba(239,68,68,0.1)" : "rgba(74,222,128,0.1)",
              color: anomalies.length > 0 ? "#fb7185" : "#4ade80",
              border: `1px solid ${
                anomalies.length > 0 ? "rgba(239,68,68,0.2)" : "rgba(74,222,128,0.2)"
              }`,
            }}
          >
            {anomalies.length} threat{anomalies.length !== 1 ? "s" : ""}
          </span>
          {critCount > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(225,29,72,0.15)", color: "#fb7185" }}
            >
              {critCount} CRIT
            </span>
          )}
          {highCount > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(234,88,12,0.15)", color: "#fb923c" }}
            >
              {highCount} HIGH
            </span>
          )}
          {medCount > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(217,119,6,0.15)", color: "#fbbf24" }}
            >
              {medCount} MED
            </span>
          )}
          {alertsFired > 0 && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{
                background: "rgba(239,68,68,0.1)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <Bell className="w-3 h-3" />
              {alertsFired} sent
            </span>
          )}
        </div>

        {/* Right: Target site link + Stop */}
        <div className="flex items-center gap-2">
          <a
            href="http://localhost:4000/attack"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            style={{
              background: "rgba(251, 113, 133, 0.1)",
              border: "1px solid rgba(251, 113, 133, 0.2)",
              color: "#fb7185",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <Sparkles className="w-3 h-3" />
            Launch Attack
          </a>
          <motion.button
            onClick={onStop}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-[11px] font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            style={{
              background: "rgba(100, 116, 139, 0.15)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#94a3b8",
              cursor: "pointer",
            }}
          >
            <WifiOff className="w-3 h-3" />
            Stop
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── 4 stats cards shown above results ────────────────────── */
function StatsCards({ result }: { result: AnalysisResult }) {
  const total = result.total_logs_parsed;
  const anomalies = result.total_anomalies;
  const cleanRate = ((1 - anomalies / Math.max(total, 1)) * 100).toFixed(1);
  const critCount = result.anomalies.filter((a) => a.severity === "CRITICAL").length;
  const highCount = result.anomalies.filter((a) => a.severity === "HIGH").length;
  const threatLevel = Math.min(critCount * 15 + highCount * 8, 100);

  const cards = [
    {
      label: "Logs Parsed",
      value: total.toLocaleString(),
      badge: "analyzed",
      badgeColor: "#818cf8",
    },
    {
      label: "Anomalies",
      value: anomalies.toString(),
      badge: anomalies > 0 ? `${critCount} critical` : "all clear",
      badgeColor: anomalies > 0 ? "#fb7185" : "#2dd4bf",
    },
    {
      label: "Clean Rate",
      value: `${cleanRate}%`,
      badge: parseFloat(cleanRate) > 95 ? "healthy" : "review needed",
      badgeColor: parseFloat(cleanRate) > 95 ? "#2dd4bf" : "#fb923c",
    },
    {
      label: "Threat Level",
      value: `${threatLevel}%`,
      badge: threatLevel > 60 ? "critical" : threatLevel > 30 ? "high" : threatLevel > 10 ? "medium" : "low",
      badgeColor: threatLevel > 60 ? "#fb7185" : threatLevel > 30 ? "#fb923c" : "#fbbf24",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, type: "spring", stiffness: 250, damping: 22 }}
          style={{
            background: "rgba(15,23,42,0.6)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            padding: "1rem 1.25rem",
          }}
        >
          <p className="text-2xl font-bold tabular-nums mb-0.5" style={{ color: "#e2e8f0" }}>
            {card.value}
          </p>
          <p className="text-xs mb-2" style={{ color: "#64748b" }}>{card.label}</p>
          <span className="text-[10px] font-medium" style={{ color: card.badgeColor }}>
            {card.badge}
          </span>
        </motion.div>
      ))}
    </div>
  );
}


/* -- Particle dot for landing background -- */
function ParticleDot({
  x, y, size, opacity, delay, color, glowColor,
}: {
  x: number; y: number; size: number;
  opacity: number; delay: number;
  color: string; glowColor: string;
}) {
  const glowSize = size * 5;
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: `radial-gradient(circle, rgba(${color},1) 0%, rgba(${color},0.7) 40%, rgba(${color},0) 100%)`,
        boxShadow: `0 0 ${glowSize}px ${glowSize / 2}px rgba(${glowColor},0.5)`,
      }}
      animate={{
        opacity: [opacity * 0.3, opacity, opacity * 0.15, opacity, opacity * 0.3],
        scale:   [1, 1.4, 0.9, 1.2, 1],
      }}
      transition={{
        duration: 2 + delay * 1.5,
        repeat: Infinity,
        delay: delay * 0.8,
        ease: "easeInOut",
      }}
    />
  );
}

/* ── Landing page ────────────────────────────────────────────── */
function LandingPage({
  onUpload,
  onMonitor,
}: {
  onUpload: () => void;
  onMonitor: () => void;
}) {
  // Generate particles only on client to avoid SSR hydration mismatch
  const [particles, setParticles] = useState<Array<{
    id: number; x: number; y: number; size: number;
    opacity: number; delay: number; color: string; glowColor: string;
  }>>([]);

  useEffect(() => {
    // Color palette matching landing page: indigo, teal, violet, soft white
    const palette = [
      { color: '129,140,248', glow: '99,102,241' },   // indigo
      { color: '167,139,250', glow: '124,58,237' },   // violet
      { color: '45,212,191',  glow: '20,184,166' },   // teal
      { color: '224,231,255', glow: '129,140,248' },  // near-white indigo
    ];
    setParticles(
      Array.from({ length: 150 }, (_, i) => {
        const p = palette[Math.floor(Math.random() * palette.length)];
        // 70% tiny (1-2px), 22% medium (2-4px), 8% large (4-6px)
        const r = Math.random();
        const size = r < 0.70 ? Math.random() * 1.5 + 0.8
                   : r < 0.92 ? Math.random() * 2  + 2
                   :             Math.random() * 2  + 4;
        return {
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size,
          opacity: Math.random() * 0.4 + 0.55,
          delay: Math.random() * 4,
          color: p.color,
          glowColor: p.glow,
        };
      })
    );
  }, []);

  const steps = [
    {
      icon: <Upload className="w-6 h-6" />,
      title: "Upload Log File",
      desc: "Drag and drop your SSH or application log file into the analyzer.",
    },
    {
      icon: <Activity className="w-6 h-6" />,
      title: "ML Scan Runs",
      desc: "Isolation Forest model scans every log line for behavioral anomalies.",
    },
    {
      icon: <ShieldAlert className="w-6 h-6" />,
      title: "Threats Flagged",
      desc: "Critical, high, medium, and low anomalies are ranked and categorized.",
    },
    {
      icon: <Brain className="w-6 h-6" />,
      title: "AI Briefing",
      desc: "Gemini generates an executive summary with step-by-step remediation.",
    },
  ];

  return (
    <div
      className="relative min-h-screen overflow-y-auto overflow-x-hidden"
      style={{
        background: "#0a0d14",
        fontFamily: "var(--font-sans)",
        scrollBehavior: "smooth",
      }}
    >
      {/* ── Particle background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <ParticleDot key={p.id} {...p} />
        ))}
        {/* subtle radial glow center */}
        <div
          className="absolute"
          style={{
            top: "20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "600px",
            height: "300px",
            background: "radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ── Navbar ── */}
      <nav
        className="relative z-20 flex items-center justify-between px-8 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #818cf8, #6366f1)",
              boxShadow: "0 4px 14px rgba(99,102,241,0.45)",
            }}
          >
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold" style={{ color: "#e2e8f0" }}>
            Red<span style={{ color: "#818cf8" }}>Flag</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            onClick={onUpload}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: "8px 20px",
              borderRadius: "999px",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "white",
              background: "linear-gradient(135deg, #818cf8, #6366f1)",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
            }}
          >
            Launch App
          </motion.button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-20 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div
            className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(129,140,248,0.25)",
              color: "#818cf8",
            }}
          >
            <Zap className="w-3.5 h-3.5" />
            AI-Powered Security Analysis
          </div>
          <h1
            className="text-5xl sm:text-6xl font-bold leading-tight mb-5"
            style={{ color: "#e2e8f0" }}
          >
            Red<span style={{
              background: "linear-gradient(135deg, #818cf8, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>Flag</span>
          </h1>
          <p
            className="text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed"
            style={{ color: "#64748b" }}
          >
            Detect SSH and application log anomalies instantly with ML.
            Understand every threat with Gemini AI briefings — executive
            summaries, technical deep-dives, and remediation in seconds.
          </p>
          <div className="flex items-center gap-3 justify-center flex-wrap">
            <motion.button
              onClick={onUpload}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="pill-primary flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Logs
            </motion.button>
            <motion.button
              onClick={onMonitor}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="pill-ghost flex items-center gap-2"
            >
              <Radio className="w-4 h-4" />
              Start Monitoring
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* ── Features strip — no cards ── */}
      <section
        className="relative z-10 px-6 py-16"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: "#e2e8f0" }}>
            Everything you need to monitor security
          </h2>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Powerful features designed to make threat detection effortless.
          </p>
        </motion.div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-0">
          {[
            {
              icon: <Zap className="w-5 h-5" />,
              color: "#818cf8",
              title: "Real-time Detection",
              desc: "Isolation Forest ML flags anomalies the moment they appear — brute-force, lateral movement, zero-day patterns.",
            },
            {
              icon: <Brain className="w-5 h-5" />,
              color: "#2dd4bf",
              title: "AI Security Insights",
              desc: "Gemini briefings explain each attack with executive summaries, technical deep-dives, and remediation steps.",
            },
            {
              icon: <Bell className="w-5 h-5" />,
              color: "#fb923c",
              title: "Automated Alerts",
              desc: "Critical and high-severity threats trigger instant email alerts. Block lists generated on demand.",
            },
          ].map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.45 }}
              className="flex flex-col px-8 py-4"
              style={{
                borderLeft: i > 0 ? "1px solid rgba(129,140,248,0.1)" : "none",
              }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <span style={{ color: feat.color }}>{feat.icon}</span>
                <span className="font-semibold text-sm" style={{ color: "#e2e8f0" }}>
                  {feat.title}
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>
                {feat.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section
        className="relative z-10 px-6 py-20"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: "#e2e8f0" }}>
            How It Works
          </h2>
          <p className="text-sm" style={{ color: "#64748b" }}>
            From log file to full threat briefing in four simple steps.
          </p>
        </motion.div>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start gap-8 sm:gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.45 }}
              className="flex-1 flex flex-col items-center text-center gap-3"
            >
              <div className="relative">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "rgba(30,41,59,0.7)",
                    border: "1px solid rgba(129,140,248,0.18)",
                    color: "#818cf8",
                  }}
                >
                  {step.icon}
                </div>
                <div
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #818cf8, #6366f1)" }}
                >
                  {i + 1}
                </div>
              </div>
              <p className="font-semibold text-sm" style={{ color: "#e2e8f0" }}>{step.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section
        className="relative z-10 px-6 py-20 text-center"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: "#e2e8f0" }}>
            Start Detecting Threats Today
          </h2>
          <p className="text-sm max-w-xl mx-auto leading-relaxed" style={{ color: "#64748b" }}>
            Upload your SSH or application log file and let RedFlag do the rest. Isolation Forest ML surfaces every anomaly instantly — brute-force attempts, lateral movement, zero-day patterns — while Gemini AI generates a full executive briefing with remediation steps, all in seconds.
          </p>
        </motion.div>
      </section>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────── */
export default function Home() {
  const [showLanding, setShowLanding] = useState(true);
  const [activeNav, setActiveNav] = useState<NavItem>("dashboard");
  const [state, setState] = useState<AnalysisState>({ phase: "idle" });
  const [selectedIP, setSelectedIP] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const currentLabelRef = useRef<string>("");
  const prevPhaseRef = useRef<string>("idle");
  const watchAbortRef = useRef<AbortController | null>(null);
  const briefingAbortRef = useRef<AbortController | null>(null);
  const briefingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoStartedRef = useRef(false);

  /* ── Load history from localStorage on mount ─────────────── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("log_sentinel_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  /* ── Auto-switch nav when phase changes ──────────────────── */
  useEffect(() => {
    if (state.phase === "done") setActiveNav("dashboard");
    if (state.phase === "live_monitoring") setActiveNav("dashboard");
  }, [state.phase]);

  /* ── Save to history when analysis finishes ──────────────── */
  useEffect(() => {
    if (state.phase === "done" && prevPhaseRef.current !== "done") {
      const entry: HistoryEntry = {
        id: Date.now().toString(),
        label: currentLabelRef.current,
        timestamp: new Date().toISOString(),
        totalLogs: state.result.total_logs_parsed,
        anomalyCount: state.result.total_anomalies,
        severityCounts: (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Severity[]).reduce(
          (acc, sev) => ({
            ...acc,
            [sev]: state.result.anomalies.filter((a) => a.severity === sev).length,
          }),
          {} as Record<Severity, number>,
        ),
        result: state.result,
        briefing: state.briefing,
      };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 20);
        try {
          localStorage.setItem("log_sentinel_history", JSON.stringify(next));
        } catch { /* ignore */ }
        return next;
      });
      setActiveHistoryId(entry.id);
    }
    prevPhaseRef.current = state.phase;
  }, [state]);

  /* ── Handlers ────────────────────────────────────────────── */
  const handleFileSelected = useCallback((file: File) => {
    currentLabelRef.current = file.name;
    analyzeLog(file, TOP_N, setState);
  }, []);

  const handleLiveMonitor = useCallback(async () => {
    const abort = new AbortController();
    watchAbortRef.current = abort;
    setState({
      phase: "live_monitoring",
      anomalies: [],
      alertsFired: 0,
      briefing: null,
      briefingChunks: "",
    });

    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/watch`, {
        headers: { Accept: "text/event-stream" },
        signal: abort.signal,
      });
    } catch {
      if (!abort.signal.aborted) {
        setState({
          phase: "error",
          message: "Cannot connect to backend. Is it running on port 8000?",
        });
      }
      return;
    }

    if (!response.ok || !response.body) {
      setState({ phase: "error", message: `Server error: ${response.status}` });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventType = "";
    let dataBuffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
            dataBuffer = "";
          } else if (line.startsWith("data: ")) {
            dataBuffer += line.slice(6);
          } else if (line.trim() === "" && eventType && dataBuffer) {
            try {
              if (eventType === "anomaly") {
                const anomaly = JSON.parse(dataBuffer) as Anomaly;
                if (
                  anomaly.severity === "CRITICAL" ||
                  anomaly.severity === "HIGH"
                ) {
                  sendEmailAlert(anomaly).catch((e) =>
                    console.error("[emailRelay]", e)
                  );
                }
                setState((prev) => {
                  if (prev.phase !== "live_monitoring") return prev;
                  const alreadyExists = prev.anomalies.some(
                    (a) => a.parsed_log.raw === anomaly.parsed_log.raw
                  );
                  if (alreadyExists) return prev;
                  const fired =
                    anomaly.severity === "CRITICAL" ||
                    anomaly.severity === "HIGH"
                      ? prev.alertsFired + 1
                      : prev.alertsFired;
                  return {
                    ...prev,
                    anomalies: [anomaly, ...prev.anomalies],
                    alertsFired: fired,
                  };
                });
              }
            } catch { /* ignore parse errors */ }
            eventType = "";
            dataBuffer = "";
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setState({ phase: "error", message: "Live monitor connection lost." });
      }
    }
  }, []);

  const handleStopMonitor = useCallback(() => {
    watchAbortRef.current?.abort();
    briefingAbortRef.current?.abort();
    if (briefingDebounceRef.current) clearTimeout(briefingDebounceRef.current);
    watchAbortRef.current = null;
    setState({ phase: "idle" });
    setActiveNav("dashboard");
  }, []);

  const triggerLiveBriefing = useCallback(async (anomalies: Anomaly[]) => {
    briefingAbortRef.current?.abort();
    const abort = new AbortController();
    briefingAbortRef.current = abort;

    setState((prev) =>
      prev.phase === "live_monitoring"
        ? { ...prev, briefing: null, briefingChunks: "" }
        : prev
    );

    try {
      const resp = await fetch(`${API_URL}/api/briefing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ anomalies }),
        signal: abort.signal,
      });
      if (!resp.ok || !resp.body) return;

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let evType = "";
      let evData = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            evType = line.slice(7).trim();
            evData = "";
          } else if (line.startsWith("data: ")) {
            evData += line.slice(6);
          } else if (line.trim() === "" && evType && evData) {
            try {
              if (evType === "briefing_chunk") {
                setState((prev) =>
                  prev.phase === "live_monitoring"
                    ? { ...prev, briefingChunks: prev.briefingChunks + evData }
                    : prev
                );
              } else if (evType === "briefing_done") {
                const briefing = JSON.parse(evData);
                setState((prev) =>
                  prev.phase === "live_monitoring"
                    ? { ...prev, briefing, briefingChunks: "" }
                    : prev
                );
              }
            } catch { /* ignore */ }
            evType = "";
            evData = "";
          }
        }
      }
    } catch { /* AbortError expected on new trigger */ }
  }, []);

  /* ── Auto-briefing when live anomalies change ──────────────── */
  const liveAnomalyCount =
    state.phase === "live_monitoring" ? state.anomalies.length : -1;

  useEffect(() => {
    if (liveAnomalyCount <= 0) return;
    const anomalies = (
      state as Extract<typeof state, { phase: "live_monitoring" }>
    ).anomalies;
    const hasSevere = anomalies.some(
      (a) => a.severity === "CRITICAL" || a.severity === "HIGH"
    );
    if (!hasSevere) return;
    if (briefingDebounceRef.current) clearTimeout(briefingDebounceRef.current);
    briefingDebounceRef.current = setTimeout(() => {
      triggerLiveBriefing(anomalies);
    }, 1500);
    return () => {
      if (briefingDebounceRef.current) clearTimeout(briefingDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveAnomalyCount]);

  const handleReset = useCallback(() => {
    setState({ phase: "idle" });
    setActiveHistoryId(null);
    setActiveNav("upload");
  }, []);

  const handleSelectHistory = useCallback((entry: HistoryEntry) => {
    setActiveHistoryId(entry.id);
    setActiveNav("dashboard");
    setState({
      phase: "done",
      result: entry.result,
      briefing: entry.briefing ?? {
        executive_summary: "",
        technical_details: "",
        remediation_steps: [],
      },
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    setActiveHistoryId(null);
    try {
      localStorage.removeItem("log_sentinel_history");
    } catch { /* ignore */ }
  }, []);

  // ── Email report state ────────────────────────────────────────
  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [emailError, setEmailError] = useState("");

  const handleSendReport = useCallback(async () => {
    if (!emailInput.trim() || state.phase !== "done") return;
    setEmailStatus("sending");
    setEmailError("");
    try {
      const pdf64 = await generatePDFBase64(
        state.result,
        state.briefing,
        currentLabelRef.current || "analysis"
      );
      const filename = `log-sentinel-${new Date().toISOString().slice(0, 10)}.pdf`;
      const res = await fetch(`${API_URL}/api/email-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim(), pdf_base64: pdf64, filename }),
      });
      if (!res.ok) {
        setEmailStatus("error");
        setEmailError(`Server error ${res.status} — restart the backend.`);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setEmailStatus("sent");
        setTimeout(() => {
          setEmailStatus("idle");
          setEmailPanelOpen(false);
          setEmailInput("");
        }, 2500);
      } else {
        setEmailStatus("error");
        setEmailError(data.error || "Unknown error from server.");
      }
    } catch {
      setEmailStatus("error");
      setEmailError("Network error — is the backend running?");
    }
  }, [emailInput, state]);

  const isProcessing = state.phase === "uploading" || state.phase === "analyzing";
  const hasResults =
    state.phase === "streaming_briefing" || state.phase === "done";
  const isLiveMonitor = state.phase === "live_monitoring";
  const result = hasResults ? state.result : null;

  /* ── Auto-start live monitoring when entering dashboard ─── */
  useEffect(() => {
    if (!showLanding && !hasAutoStartedRef.current && state.phase === "idle") {
      hasAutoStartedRef.current = true;
      handleLiveMonitor();
    }
  }, [showLanding, state.phase, handleLiveMonitor]);

  /* ── Landing page ──────────────────────────────────────────── */
  if (showLanding) {
    return (
      <LandingPage
        onUpload={() => {
          setShowLanding(false);
          setActiveNav("upload");
        }}
        onMonitor={() => {
          setShowLanding(false);
          setActiveNav("dashboard");
          handleLiveMonitor();
        }}
      />
    );
  }

  const NAV_ITEMS: {
    id: NavItem;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-4 h-4 nav-icon" />,
    },
    {
      id: "upload",
      label: "Upload Logs",
      icon: <Upload className="w-4 h-4 nav-icon" />,
    },
    {
      id: "monitor",
      label: "Live Monitor",
      icon: <Radio className="w-4 h-4 nav-icon" />,
    },
    {
      id: "history",
      label: "History",
      icon: <History className="w-4 h-4 nav-icon" />,
    },
  ];

  /* ── Dashboard App ─────────────────────────────────────────── */
  return (
    <div className="flex w-full h-screen p-4 md:p-6 lg:p-8 font-sans items-center justify-center overflow-hidden">
      {/* IP Detail Panel — shown above everything */}
      {selectedIP &&
        (() => {
          const allAnomalies =
            state.phase === "done"
              ? state.result.anomalies
              : state.phase === "live_monitoring"
              ? state.anomalies
              : [];
          return (
            <IPDetailPanel
              ip={selectedIP}
              allAnomalies={allAnomalies}
              onClose={() => setSelectedIP(null)}
            />
          );
        })()}

      {/* ── OUTER GLASS RECTANGLE ────────────────────────────── */}
      <div className="glass-outer w-full max-w-[1700px] h-full flex overflow-hidden">

        {/* ── LEFT SIDEBAR ─────────────────────────────────── */}
        <aside
          className="w-[260px] flex-shrink-0 h-full hidden lg:flex flex-col"
          style={{ borderRight: "1px solid rgba(129,140,248,0.12)" }}
        >
          <div className="w-full h-full flex flex-col overflow-hidden p-4">

            {/* Logo */}
            <div
              className="px-2 pt-3 pb-4 mb-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #818cf8, #6366f1)",
                    boxShadow:
                      "0 4px 14px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
                  }}
                >
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1
                    className="text-base font-bold tracking-tight"
                    style={{ color: "#e2e8f0" }}
                  >
                    RedFlag
                  </h1>
                  <p className="text-[10px]" style={{ color: "#64748b" }}>
                    AI Security Platform
                  </p>
                </div>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex flex-col gap-0.5 mb-4">
              {NAV_ITEMS.map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === "monitor" && !isLiveMonitor) {
                        setActiveNav("monitor");
                        handleLiveMonitor();
                      } else if (item.id === "upload") {
                        if (isLiveMonitor) handleStopMonitor();
                        setActiveNav("upload");
                        setState({ phase: "idle" });
                        setActiveHistoryId(null);
                      } else {
                        setActiveNav(item.id);
                      }
                    }}
                    className={`nav-item ${isActive ? "active" : ""}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {item.id === "monitor" && isLiveMonitor && (
                      <span className="ml-auto flex items-center gap-1.5">
                        <span
                          className="relative flex h-2 w-2"
                        >
                          <span
                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                            style={{ background: "#ef4444" }}
                          />
                          <span
                            className="relative inline-flex rounded-full h-2 w-2"
                            style={{ background: "#ef4444" }}
                          />
                        </span>
                        <span
                          className="text-[10px] font-mono font-bold"
                          style={{ color: "#ef4444" }}
                        >
                          LIVE
                        </span>
                      </span>
                    )}
                    {item.id === "dashboard" && result && !isActive && (
                      <span
                        className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          background: "rgba(129,140,248,0.14)",
                          color: "#818cf8",
                        }}
                      >
                        {result.total_anomalies}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Recent scans divider */}
            <div
              className="flex items-center gap-2 mb-3 px-1"
              style={{
                borderTop: "1px solid rgba(255,255,255,0.07)",
                paddingTop: "12px",
              }}
            >
              <History className="w-3 h-3" style={{ color: "#475569" }} />
              <span
                className="text-[10px] uppercase tracking-wider font-semibold"
                style={{ color: "#475569" }}
              >
                Recent Scans
              </span>
              {history.length > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto"
                  style={{
                    background: "rgba(129,140,248,0.12)",
                    color: "#818cf8",
                  }}
                >
                  {history.length}
                </span>
              )}
            </div>

            {/* History list */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ scrollbarWidth: "none" }}
            >
              <HistorySidebar
                history={history}
                activeId={activeHistoryId}
                onSelect={handleSelectHistory}
                onClear={handleClearHistory}
              />
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ─────────────────────────────────── */}
        <main
          className="flex-1 h-full relative overflow-y-auto p-6 pb-12"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="w-full mx-auto flex flex-col gap-5">

            {/* ── LIVE MONITOR STRIP — always at top of dashboard ── */}
            {isLiveMonitor && state.phase === "live_monitoring" && (
              <LiveMonitorStrip
                anomalies={state.anomalies}
                alertsFired={state.alertsFired}
                isConnected={true}
                onStop={handleStopMonitor}
              />
            )}

            {/* Header */}
            <header
              className="flex items-center justify-between pb-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              {/* Mobile: show logo */}
              <div className="flex items-center gap-2 lg:hidden">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #818cf8, #6366f1)",
                    boxShadow: "0 4px 10px rgba(99,102,241,0.35)",
                  }}
                >
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <h1
                  className="text-base font-bold"
                  style={{ color: "#e2e8f0" }}
                >
                  RedFlag
                </h1>
              </div>

              {/* Desktop: status strip */}
              <div className="hidden lg:flex items-center gap-3">
                {isLiveMonitor ? (
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ background: "#ef4444" }}
                      />
                      <span
                        className="relative inline-flex rounded-full h-2.5 w-2.5"
                        style={{ background: "#ef4444" }}
                      />
                    </span>
                    <span
                      className="text-sm font-bold tracking-wide"
                      style={{ color: "#ef4444" }}
                    >
                      LIVE
                    </span>
                    <span
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md"
                      style={{
                        background: "rgba(30,41,59,0.8)",
                        color: "#94a3b8",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      {state.anomalies.find((a) => a.target_url)?.target_url
                        ? (() => {
                            try {
                              const u = state.anomalies.find((a) => a.target_url)!.target_url!;
                              return new URL(u.startsWith("http") ? u : "https://" + u).hostname;
                            } catch { return "monitoring"; }
                          })()
                        : "monitoring"}
                    </span>
                    <span
                      className="text-sm font-mono px-3 py-1 rounded-full"
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        color: "#fb7185",
                        border: "1px solid rgba(239,68,68,0.2)",
                      }}
                    >
                      {state.anomalies.length} threats
                    </span>
                    {state.alertsFired > 0 && (
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{
                          background: "rgba(239,68,68,0.1)",
                          color: "#ef4444",
                          border: "1px solid rgba(239,68,68,0.2)",
                        }}
                      >
                        <Bell className="w-3 h-3" />
                        {state.alertsFired} alert
                        {state.alertsFired !== 1 ? "s" : ""} sent
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: "rgba(129,140,248,0.45)" }}
                    />
                    <span
                      className="text-sm font-medium"
                      style={{ color: "#64748b" }}
                    >
                      {activeNav === "dashboard"
                        ? "Dashboard"
                        : activeNav === "upload"
                        ? "Upload Logs"
                        : activeNav === "monitor"
                        ? "Live Monitor"
                        : "History"}
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {state.phase === "done" && (
                  <>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() =>
                        downloadPDFReport(
                          state.result,
                          state.briefing,
                          currentLabelRef.current || "analysis"
                        )
                      }
                      className="pill-ghost flex items-center gap-1.5"
                      style={{ padding: "7px 14px", fontSize: "0.8rem" }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </motion.button>

                    {/* Email report button + inline panel */}
                    <AnimatePresence mode="wait">
                      {!emailPanelOpen ? (
                        <motion.button
                          key="email-btn"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={() => {
                            setEmailPanelOpen(true);
                            setEmailStatus("idle");
                            setEmailError("");
                          }}
                          className="pill-ghost flex items-center gap-1.5"
                          style={{ padding: "7px 14px", fontSize: "0.8rem" }}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Email
                        </motion.button>
                      ) : (
                        <motion.div
                          key="email-panel"
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          className="flex items-center gap-1.5 overflow-hidden"
                          style={{
                            background: "rgba(15,23,42,0.8)",
                            border: "1px solid rgba(129,140,248,0.25)",
                            borderRadius: 999,
                            padding: "4px 4px 4px 12px",
                          }}
                        >
                          {emailStatus === "sent" ? (
                            <span className="flex items-center gap-1.5 text-xs font-medium px-2" style={{ color: "#4ade80", whiteSpace: "nowrap" }}>
                              <CheckCircle className="w-3.5 h-3.5" />
                              Sent!
                            </span>
                          ) : (
                            <>
                              <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: "#818cf8" }} />
                              <input
                                type="email"
                                value={emailInput}
                                onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }}
                                onKeyDown={(e) => e.key === "Enter" && handleSendReport()}
                                placeholder="recipient@email.com"
                                autoFocus
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                  fontSize: "0.78rem",
                                  color: "#e2e8f0",
                                  width: 170,
                                }}
                              />
                              {emailError && (
                                <span className="text-[10px]" style={{ color: "#fb7185", maxWidth: 200 }}>
                                  {emailError}
                                </span>
                              )}
                              <button
                                onClick={handleSendReport}
                                disabled={emailStatus === "sending" || !emailInput.trim()}
                                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full"
                                style={{
                                  background: emailStatus === "sending" ? "rgba(129,140,248,0.2)" : "rgba(129,140,248,0.9)",
                                  color: "white",
                                  border: "none",
                                  cursor: emailStatus === "sending" || !emailInput.trim() ? "not-allowed" : "pointer",
                                  opacity: !emailInput.trim() ? 0.5 : 1,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {emailStatus === "sending" ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Send className="w-3 h-3" />
                                )}
                                {emailStatus === "sending" ? "Sending…" : "Send"}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => { setEmailPanelOpen(false); setEmailInput(""); setEmailStatus("idle"); setEmailError(""); }}
                            className="flex items-center justify-center w-6 h-6 rounded-full"
                            style={{ color: "#64748b", background: "transparent", border: "none", cursor: "pointer" }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.05 }}
                      onClick={() =>
                        downloadBlocklist(
                          state.result.anomalies,
                          currentLabelRef.current || "analysis"
                        )
                      }
                      className="pill-ghost flex items-center gap-1.5"
                      style={{
                        padding: "7px 14px",
                        fontSize: "0.8rem",
                        color: "#fb7185",
                      }}
                    >
                      <ShieldOff className="w-3.5 h-3.5" />
                      Blocklist
                    </motion.button>
                  </>
                )}
                {isLiveMonitor && state.anomalies.length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() =>
                      downloadBlocklist(state.anomalies, "live-monitor")
                    }
                    className="pill-ghost flex items-center gap-1.5"
                    style={{
                      padding: "7px 14px",
                      fontSize: "0.8rem",
                      color: "#fb7185",
                    }}
                  >
                    <ShieldOff className="w-3.5 h-3.5" />
                    Blocklist
                  </motion.button>
                )}
                {(hasResults || isLiveMonitor) && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={isLiveMonitor ? handleStopMonitor : handleReset}
                    className="pill-ghost flex items-center gap-1.5"
                    style={{ padding: "7px 14px", fontSize: "0.8rem" }}
                  >
                    {isLiveMonitor ? (
                      <>
                        <WifiOff className="w-3.5 h-3.5" />
                        Stop
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        New
                      </>
                    )}
                  </motion.button>
                )}
                {/* Back to landing */}
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setShowLanding(true)}
                  className="pill-ghost"
                  style={{ padding: "7px 11px", fontSize: "0.8rem" }}
                  title="Back to home"
                >
                  <X className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </header>

            <AnimatePresence mode="wait">

              {/* PROCESSING */}
              {isProcessing && (
                <motion.div
                  key="scanning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center py-20"
                >
                  <ScanAnimation phase={state.phase as "uploading" | "analyzing"} />
                </motion.div>
              )}

              {/* ERROR */}
              {state.phase === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-4 py-16"
                >
                  <div className="glass-critical p-8 rounded-[24px] text-center max-w-md">
                    <h3
                      className="text-lg font-semibold mb-2"
                      style={{ color: "#fda4af" }}
                    >
                      Analysis Failed
                    </h3>
                    <p
                      className="text-sm opacity-80"
                      style={{ color: "#fda4af" }}
                    >
                      {state.message}
                    </p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="pill-ghost flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Try Again
                  </button>
                </motion.div>
              )}

              {/* UPLOAD nav */}
              {!isProcessing &&
                state.phase !== "error" &&
                activeNav === "upload" &&
                !isLiveMonitor && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    className="flex flex-col items-center justify-center gap-5 py-12"
                  >
                    <div className="text-center max-w-md">
                      <h2
                        className="text-xl font-bold"
                        style={{ color: "#e2e8f0" }}
                      >
                        Upload Log Files
                      </h2>
                      <p
                        className="text-sm mt-2 leading-relaxed"
                        style={{ color: "#64748b" }}
                      >
                        Upload{" "}
                        <code
                          className="font-mono"
                          style={{ color: "#818cf8" }}
                        >
                          .log
                        </code>{" "}
                        or{" "}
                        <code
                          className="font-mono"
                          style={{ color: "#818cf8" }}
                        >
                          .txt
                        </code>{" "}
                        files. Isolation Forest ML detects anomalies; Gemini
                        generates the executive briefing.
                      </p>
                    </div>
                    <UploadZone onFileSelected={handleFileSelected} />
                  </motion.div>
                )}

              {/* MONITOR nav — idle */}
              {!isProcessing &&
                state.phase !== "error" &&
                activeNav === "monitor" &&
                !isLiveMonitor && (
                  <motion.div
                    key="monitor-idle"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center gap-5 py-16"
                  >
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center mb-2"
                      style={{
                        background: "rgba(99,102,241,0.1)",
                        border: "1px solid rgba(129,140,248,0.2)",
                      }}
                    >
                      <Radio
                        className="w-8 h-8"
                        style={{ color: "#818cf8" }}
                      />
                    </div>
                    <div className="text-center max-w-sm">
                      <h2
                        className="text-xl font-bold mb-2"
                        style={{ color: "#e2e8f0" }}
                      >
                        Live Monitor
                      </h2>
                      <p className="text-sm" style={{ color: "#64748b" }}>
                        Watch the target site in real-time. Anomalies appear
                        instantly as they happen on{" "}
                        <code
                          className="font-mono"
                          style={{ color: "#818cf8" }}
                        >
                          localhost:4000
                        </code>
                        .
                      </p>
                    </div>
                    <motion.button
                      onClick={handleLiveMonitor}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      className="pill-primary flex items-center gap-2"
                    >
                      <Radio className="w-4 h-4" />
                      Start Monitoring
                    </motion.button>
                  </motion.div>
                )}

              {/* LIVE MONITORING ACTIVE */}
              {isLiveMonitor && state.phase === "live_monitoring" && (
                <motion.div
                  key="live"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  {state.anomalies.length === 0 ? (
                    <div
                      className="glass flex flex-col items-center justify-center gap-3 py-16"
                      style={{ borderRadius: "20px" }}
                    >
                      <div className="flex items-center gap-2">
                        <Radio
                          className="w-5 h-5 animate-pulse"
                          style={{ color: "#818cf8" }}
                        />
                        <span
                          className="text-sm font-medium"
                          style={{ color: "#94a3b8" }}
                        >
                          Watching for threats…
                        </span>
                      </div>
                      <p
                        className="text-[12px] text-center max-w-sm"
                        style={{ color: "#64748b" }}
                      >
                        Open{" "}
                        <a
                          href="http://localhost:4000/attack"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono font-semibold"
                          style={{ color: "#818cf8", textDecoration: "underline" }}
                        >
                          localhost:4000/attack
                        </a>{" "}
                        to launch an attack on any website. Threats will appear here in real-time.
                      </p>
                    </div>
                  ) : (
                    <>
                      <SeverityBar
                        anomalies={state.anomalies}
                        totalLogs={Math.max(state.anomalies.length * 5, 60)}
                      />
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <MetricsChart
                          result={{
                            anomalies: state.anomalies,
                            total_logs_parsed: Math.max(
                              state.anomalies.length * 5,
                              60
                            ),
                            total_anomalies: state.anomalies.length,
                            rule_flagged: state.anomalies.filter(
                              (a) => a.threat_score > 0
                            ).length,
                          }}
                        />
                        <ThreatMap anomalies={state.anomalies} />
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <AttackTimeline
                          anomalies={state.anomalies}
                          onIPClick={setSelectedIP}
                        />
                        <AnomalyList
                          anomalies={state.anomalies}
                          onIPClick={setSelectedIP}
                        />
                      </div>
                      <AIBriefingCard
                        briefing={state.briefing}
                        streamingText={state.briefingChunks || undefined}
                        isStreaming={state.briefingChunks.length > 0}
                      />
                      <FollowUpChat
                        anomalies={state.anomalies}
                        briefing={state.briefing}
                      />
                    </>
                  )}
                </motion.div>
              )}

              {/* RESULTS (dashboard nav or streaming) */}
              {!isProcessing &&
                state.phase !== "error" &&
                !isLiveMonitor &&
                hasResults &&
                result &&
                (activeNav === "dashboard" ||
                  state.phase === "streaming_briefing") && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col gap-4"
                  >
                    <StatsCards result={result} />
                    <SeverityBar
                      anomalies={result.anomalies}
                      totalLogs={result.total_logs_parsed}
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <MetricsChart result={result} />
                      <ThreatMap anomalies={result.anomalies} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <AttackTimeline
                        anomalies={result.anomalies}
                        onIPClick={setSelectedIP}
                      />
                      <AnomalyList
                        anomalies={result.anomalies}
                        onIPClick={setSelectedIP}
                      />
                    </div>
                    <AIBriefingCard
                      briefing={
                        state.phase === "done" ? state.briefing : null
                      }
                      streamingText={
                        state.phase === "streaming_briefing"
                          ? state.briefingChunks
                          : undefined
                      }
                      isStreaming={state.phase === "streaming_briefing"}
                    />
                    {state.phase === "done" && (
                      <FollowUpChat
                        anomalies={result.anomalies}
                        briefing={state.briefing}
                      />
                    )}
                  </motion.div>
                )}

              {/* DASHBOARD — no results */}
              {!isProcessing &&
                state.phase !== "error" &&
                !isLiveMonitor &&
                !hasResults &&
                activeNav === "dashboard" && (
                  <motion.div
                    key="dashboard-empty"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center gap-5 py-16"
                  >
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center"
                      style={{
                        background: "rgba(99,102,241,0.08)",
                        border: "1px solid rgba(129,140,248,0.15)",
                      }}
                    >
                      <LayoutDashboard
                        className="w-8 h-8"
                        style={{ color: "#818cf8" }}
                      />
                    </div>
                    <div className="text-center max-w-sm">
                      <h2
                        className="text-xl font-bold mb-2"
                        style={{ color: "#e2e8f0" }}
                      >
                        No Analysis Yet
                      </h2>
                      <p
                        className="text-sm mb-6"
                        style={{ color: "#64748b" }}
                      >
                        Upload log files to start detecting anomalies and get
                        AI-powered security insights.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveNav("upload")}
                      className="pill-primary flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Logs
                    </button>
                  </motion.div>
                )}

              {/* HISTORY nav — main area */}
              {!isProcessing &&
                state.phase !== "error" &&
                activeNav === "history" && (
                  <motion.div
                    key="history-main"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h2
                        className="text-base font-semibold"
                        style={{ color: "#e2e8f0" }}
                      >
                        Scan History
                      </h2>
                      {history.length > 0 && (
                        <button
                          onClick={handleClearHistory}
                          className="text-xs"
                          style={{
                            color: "#64748b",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    {history.length === 0 ? (
                      <div
                        className="glass flex flex-col items-center justify-center gap-3 py-16"
                        style={{ borderRadius: "20px" }}
                      >
                        <History
                          className="w-8 h-8 opacity-20"
                          style={{ color: "#64748b" }}
                        />
                        <p
                          className="text-sm"
                          style={{ color: "#64748b" }}
                        >
                          No past scans found
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {history.map((entry) => {
                          const isActive = entry.id === activeHistoryId;
                          return (
                            <motion.button
                              key={entry.id}
                              onClick={() => handleSelectHistory(entry)}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="text-left stats-card"
                              style={{
                                border: isActive
                                  ? "1px solid rgba(129,140,248,0.4)"
                                  : undefined,
                                boxShadow: isActive
                                  ? "0 0 0 1px rgba(129,140,248,0.15)"
                                  : undefined,
                              }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Shield
                                  className="w-4 h-4 shrink-0"
                                  style={{
                                    color: isActive ? "#818cf8" : "#64748b",
                                  }}
                                />
                                <span
                                  className="text-sm font-semibold truncate"
                                  style={{ color: "#e2e8f0" }}
                                >
                                  {entry.label}
                                </span>
                              </div>
                              <div
                                className="text-xs font-mono mb-2"
                                style={{ color: "#64748b" }}
                              >
                                {entry.totalLogs.toLocaleString()} logs ·{" "}
                                {new Date(entry.timestamp).toLocaleString(
                                  [],
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {(
                                  [
                                    "CRITICAL",
                                    "HIGH",
                                    "MEDIUM",
                                    "LOW",
                                  ] as Severity[]
                                ).map((sev) => {
                                  const count = entry.severityCounts[sev];
                                  if (!count) return null;
                                  const colors: Record<Severity, string> = {
                                    CRITICAL: "#fb7185",
                                    HIGH: "#fb923c",
                                    MEDIUM: "#fbbf24",
                                    LOW: "#2dd4bf",
                                  };
                                  return (
                                    <span
                                      key={sev}
                                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                      style={{ background: colors[sev] }}
                                    >
                                      {count} {sev.slice(0, 4)}
                                    </span>
                                  );
                                })}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
