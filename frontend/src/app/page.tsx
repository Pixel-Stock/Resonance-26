"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Radio, Shield, WifiOff, Download, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { downloadPDFReport } from "@/lib/generateReport";

import { UploadZone } from "@/components/UploadZone";
import { ScanAnimation } from "@/components/ScanAnimation";
import { AnomalyList } from "@/components/AnomalyList";
import { AIBriefingCard } from "@/components/AIBriefingCard";
import { MetricsChart } from "@/components/MetricsChart";
import { ThreatMap } from "@/components/ThreatMap";
import { AttackTimeline } from "@/components/AttackTimeline";
import { SeverityBar } from "@/components/SeverityBar";
import { HistorySidebar, type HistoryEntry } from "@/components/HistorySidebar";
import { analyzeLog } from "@/lib/api";
import type { AnalysisState, Anomaly, Severity } from "@/lib/types";

const TOP_N = 10;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [state, setState] = useState<AnalysisState>({ phase: "idle" });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const currentLabelRef = useRef<string>("");
  const prevPhaseRef = useRef<string>("idle");
  const watchAbortRef = useRef<AbortController | null>(null);
  const briefingAbortRef = useRef<AbortController | null>(null);
  const briefingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load history from localStorage on mount ─────────────── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("log_sentinel_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

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
          (acc, sev) => ({ ...acc, [sev]: state.result.anomalies.filter((a) => a.severity === sev).length }),
          {} as Record<Severity, number>,
        ),
        result: state.result,
        briefing: state.briefing,
      };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 20);
        try { localStorage.setItem("log_sentinel_history", JSON.stringify(next)); } catch { /* ignore */ }
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
    setState({ phase: "live_monitoring", anomalies: [], alertsFired: 0, briefing: null, briefingChunks: "" });

    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/watch`, {
        headers: { Accept: "text/event-stream" },
        signal: abort.signal,
      });
    } catch {
      if (!abort.signal.aborted) {
        setState({ phase: "error", message: "Cannot connect to backend. Is it running on port 8000?" });
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
    // These must live OUTSIDE the while loop so state persists across chunks
    let eventType = "";
    let dataBuffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) { eventType = line.slice(7).trim(); dataBuffer = ""; }
          else if (line.startsWith("data: ")) { dataBuffer += line.slice(6); }
          else if (line.trim() === "" && eventType && dataBuffer) {
            try {
              if (eventType === "anomaly") {
                const anomaly = JSON.parse(dataBuffer) as Anomaly;
                setState((prev) => {
                  if (prev.phase !== "live_monitoring") return prev;
                  const alreadyExists = prev.anomalies.some(
                    (a) => a.parsed_log.raw === anomaly.parsed_log.raw
                  );
                  if (alreadyExists) return prev;
                  const fired = anomaly.severity === "CRITICAL" || anomaly.severity === "HIGH"
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
  }, []);

  const triggerLiveBriefing = useCallback(async (anomalies: Anomaly[]) => {
    briefingAbortRef.current?.abort();
    const abort = new AbortController();
    briefingAbortRef.current = abort;

    setState((prev) => prev.phase === "live_monitoring"
      ? { ...prev, briefing: null, briefingChunks: "" }
      : prev);

    try {
      const resp = await fetch(`${API_URL}/api/briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
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
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { evType = line.slice(7).trim(); evData = ""; }
          else if (line.startsWith("data: ")) { evData += line.slice(6); }
          else if (line.trim() === "" && evType && evData) {
            try {
              if (evType === "briefing_chunk") {
                setState((prev) => prev.phase === "live_monitoring"
                  ? { ...prev, briefingChunks: prev.briefingChunks + evData }
                  : prev);
              } else if (evType === "briefing_done") {
                const briefing = JSON.parse(evData);
                setState((prev) => prev.phase === "live_monitoring"
                  ? { ...prev, briefing, briefingChunks: "" }
                  : prev);
              }
            } catch { /* ignore */ }
            evType = ""; evData = "";
          }
        }
      }
    } catch { /* AbortError expected on new trigger */ }
  }, []);

  /* ── Auto-generate briefing when live anomalies change ───────── */
  const liveAnomalyCount = state.phase === "live_monitoring" ? state.anomalies.length : -1;
  useEffect(() => {
    if (liveAnomalyCount <= 0) return;
    // state guaranteed to be live_monitoring here because liveAnomalyCount > 0
    const anomalies = (state as Extract<typeof state, { phase: "live_monitoring" }>).anomalies;
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
  }, []);

  const handleSelectHistory = useCallback((entry: HistoryEntry) => {
    setActiveHistoryId(entry.id);
    setState({
      phase: "done",
      result: entry.result,
      briefing: entry.briefing ?? { executive_summary: "", technical_details: "", remediation_steps: [] },
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    setActiveHistoryId(null);
    try { localStorage.removeItem("log_sentinel_history"); } catch { /* ignore */ }
  }, []);

  const { data: session } = useSession();

  const isProcessing    = state.phase === "uploading" || state.phase === "analyzing";
  const hasResults      = state.phase === "streaming_briefing" || state.phase === "done";
  const isLiveMonitor   = state.phase === "live_monitoring";
  const result          = hasResults ? state.result : null;

  return (
    <div className="flex w-full h-screen p-4 md:p-6 lg:p-8 font-sans items-center justify-center overflow-hidden">
      {/* ── OUTER GLASS RECTANGLE ─────────────────────────── */}
      <div className="glass-outer w-full max-w-[1700px] h-full flex overflow-hidden">

        {/* ── LEFT SIDEBAR ─────────────────────────────────── */}
        <aside className="w-[300px] flex-shrink-0 h-full hidden lg:flex flex-col" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}>
          <div className="w-full h-full flex flex-col overflow-hidden relative p-6">
          {/* Logo lockup */}
          <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.25)" }}>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                  boxShadow: "0 4px 12px rgba(124,58,237,0.3), inset 0 1px 1px rgba(255,255,255,0.4)",
                }}
              >
                <Shield className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold tracking-tight" style={{ color: "#1e293b" }}>
                Log Sentinel
              </h1>
            </div>
            <p className="text-[11px] font-medium pl-[44px]" style={{ color: "#94a3b8" }}>
              AI Anomaly Detection
            </p>
          </div>

          {/* User info */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.2)", borderTop: "1px solid rgba(255,255,255,0.12)" }}
          >
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt=""
                className="w-8 h-8 rounded-full flex-shrink-0"
                style={{ border: "1.5px solid rgba(255,255,255,0.5)" }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                style={{ background: "linear-gradient(135deg, #a78bfa, #7c3aed)" }}
              >
                {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{ color: "#1e293b" }}>
                {session?.user?.name ?? "User"}
              </p>
              <p className="text-[10px] truncate" style={{ color: "#94a3b8" }}>
                {session?.user?.email ?? ""}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              title="Sign out"
              className="flex-shrink-0"
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#94a3b8", lineHeight: 1 }}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* History list */}
          <div className="flex-1 overflow-y-auto px-4 py-2 mt-2">
            <HistorySidebar
              history={history}
              activeId={activeHistoryId}
              onSelect={handleSelectHistory}
              onClear={handleClearHistory}
            />
          </div>
        </div>
        </aside>

        {/* ── MAIN CONTENT ──────────────────────────────────── */}
        <main className="flex-1 h-full relative overflow-y-auto p-6 pb-12" style={{scrollbarWidth: 'none'}}>
          <div className="w-full mx-auto flex flex-col gap-6">

          {/* Header */}
          <header className="flex items-center justify-between pb-4">
            {/* Mobile: show logo (sidebar hidden on mobile) */}
            <div className="flex items-center gap-2 lg:hidden">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                  boxShadow: "0 3px 8px rgba(124,58,237,0.3), inset 0 1px 1px rgba(255,255,255,0.4)",
                }}
              >
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight" style={{ color: "#1e293b" }}>Log Sentinel</h1>
              </div>
            </div>
            {/* Desktop: just a spacer to push reset btn right */}
            <div className="hidden lg:block" />

            <div className="flex items-center gap-2">
              {state.phase === "done" && (
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
                  className="pill-ghost flex items-center gap-2"
                  style={{ padding: "8px 20px", fontSize: "0.85rem" }}
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </motion.button>
              )}
              {(hasResults || isLiveMonitor) && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={isLiveMonitor ? handleStopMonitor : handleReset}
                  className="pill-ghost flex items-center gap-2"
                  style={{ padding: "8px 20px", fontSize: "0.85rem" }}
                >
                  {isLiveMonitor ? (
                    <><WifiOff className="w-4 h-4" /> Stop Monitor</>
                  ) : (
                    <><RotateCcw className="w-4 h-4" /> New Analysis</>
                  )}
                </motion.button>
              )}
            </div>
          </header>

          <AnimatePresence mode="wait">

            {/* ── IDLE ──────────────────────────────────────── */}
            {state.phase === "idle" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="flex flex-col items-center justify-center gap-5 py-12"
              >
                <div className="text-center max-w-md">
                  <h2 className="text-xl font-bold" style={{ color: "#1e293b" }}>
                    Deploy Log Files
                  </h2>
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: "#64748b" }}>
                    Upload{" "}
                    <code className="font-mono text-violet-500">.log</code> or{" "}
                    <code className="font-mono text-violet-500">.txt</code> files.
                    Isolation Forest ML detects anomalies; Gemini generates executive briefing.
                  </p>
                </div>

                <UploadZone onFileSelected={handleFileSelected} />

                {/* Live Monitor — compact, unobtrusive */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px]" style={{ color: "#cbd5e1" }}>or</span>
                  <motion.button
                    onClick={handleLiveMonitor}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full transition-all duration-200"
                    style={{
                      padding: "5px 14px",
                      background: "rgba(255,255,255,0.45)",
                      border: "1px solid rgba(255,255,255,0.65)",
                      borderTop: "1px solid rgba(255,255,255,0.92)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.88)",
                      color: "#475569",
                    }}
                  >
                    <Radio className="w-2.5 h-2.5 text-violet-500" />
                    Live Monitor
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── PROCESSING ────────────────────────────────── */}
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

            {/* ── ERROR ─────────────────────────────────────── */}
            {state.phase === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-4 py-16"
              >
                <div className="glass-critical p-8 rounded-[24px] text-center max-w-md">
                  <h3 className="text-lg font-semibold mb-2">Analysis Failed</h3>
                  <p className="text-sm opacity-80">{state.message}</p>
                </div>
                <button onClick={handleReset} className="pill-ghost flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </button>
              </motion.div>
            )}

            {/* ── LIVE MONITOR ──────────────────────────────── */}
            {isLiveMonitor && state.phase === "live_monitoring" && (
              <motion.div
                key="live"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4"
              >
                {/* Status bar */}
                <div
                  className="glass flex items-center justify-between gap-4 px-5 py-3"
                  style={{ borderRadius: "16px" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#ef4444" }} />
                      <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: "#ef4444" }} />
                    </span>
                    <span className="text-sm font-semibold" style={{ color: "#1e293b" }}>LIVE — Monitoring target-site</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md" style={{ background: "rgba(0,0,0,0.05)", color: "#64748b" }}>localhost:4000</span>
                  </div>
                  <div className="flex items-center gap-4 text-[12px]" style={{ color: "#64748b" }}>
                    <span><span className="font-bold" style={{ color: "#1e293b" }}>{state.anomalies.length}</span> threats</span>
                    {state.alertsFired > 0 && (
                      <span className="font-semibold px-2 py-0.5 rounded-full text-[11px]" style={{ background: "#fef2f2", color: "#dc2626" }}>
                        🔔 {state.alertsFired} alert{state.alertsFired !== 1 ? "s" : ""} sent
                      </span>
                    )}
                  </div>
                </div>

                {state.anomalies.length === 0 ? (
                  <div className="glass flex flex-col items-center justify-center gap-3 py-16" style={{ borderRadius: "20px" }}>
                    <div className="flex items-center gap-2" style={{ color: "#94a3b8" }}>
                      <Radio className="w-5 h-5 animate-pulse" />
                      <span className="text-sm font-medium">Watching for threats…</span>
                    </div>
                    <p className="text-[12px] text-center max-w-xs" style={{ color: "#cbd5e1" }}>
                      Open <code className="font-mono text-violet-400">localhost:4000/simulate</code> and trigger an attack
                    </p>
                  </div>
                ) : (
                  <>
                    <SeverityBar
                      anomalies={state.anomalies}
                      totalLogs={Math.max(state.anomalies.length * 5, 60)}
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <MetricsChart result={{
                        anomalies: state.anomalies,
                        total_logs_parsed: Math.max(state.anomalies.length * 5, 60),
                        total_anomalies: state.anomalies.length,
                        rule_flagged: state.anomalies.filter((a) => a.threat_score > 0).length,
                      }} />
                      <ThreatMap anomalies={state.anomalies} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <AttackTimeline anomalies={state.anomalies} />
                      <AnomalyList anomalies={state.anomalies} />
                    </div>
                    <AIBriefingCard
                      briefing={state.briefing}
                      streamingText={state.briefingChunks || undefined}
                      isStreaming={state.briefingChunks.length > 0}
                    />
                  </>
                )}
              </motion.div>
            )}

            {/* ── RESULTS ───────────────────────────────────── */}
            {hasResults && result && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col gap-4"
              >
                <SeverityBar anomalies={result.anomalies} totalLogs={result.total_logs_parsed} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <MetricsChart result={result} />
                  <ThreatMap anomalies={result.anomalies} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <AttackTimeline anomalies={result.anomalies} />
                  <AnomalyList anomalies={result.anomalies} />
                </div>

                <AIBriefingCard
                  briefing={state.phase === "done" ? state.briefing : null}
                  streamingText={state.phase === "streaming_briefing" ? state.briefingChunks : undefined}
                  isStreaming={state.phase === "streaming_briefing"}
                />
              </motion.div>
            )}

            </AnimatePresence>
          </div>
        </main>

      </div>{/* end outer glass */}
    </div>
  );
}
