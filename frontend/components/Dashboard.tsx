'use client';

import { useState, useCallback } from 'react';
import { analyzeFile, analyzeText, loadDemoLog } from '../lib/api';
import { AnalysisResult, Anomaly, FilterType } from '../lib/types';
import MetricsBar from './MetricsBar';
import AnomalyList from './AnomalyList';
import AnomalyDetail from './AnomalyDetail';
import UploadZone from './UploadZone';
import ScanOverlay from './ScanOverlay';

export default function Dashboard() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [error, setError] = useState<string | null>(null);

  const runScan = useCallback(async (action: () => Promise<AnalysisResult>) => {
    setScanning(true);
    setScanProgress(0);
    setError(null);
    setScanLogs([]);

    const logMessages = [
      'INITIALIZING LOG-SENTINEL ENGINE...',
      'PARSING LOG FORMAT — AUTH.LOG DETECTED',
      'EXTRACTING IP ADDRESSES AND TIMESTAMPS...',
      'ENGINEERING 14 BEHAVIORAL FEATURES...',
      'TRAINING ISOLATION FOREST (100 ESTIMATORS)...',
      'SCORING ANOMALY CANDIDATES...',
      'APPLYING RULE-BASED TYPE CLASSIFIERS...',
      'RANKING TOP 5 THREATS BY SEVERITY...',
      'CROSS-REFERENCING TOR EXIT NODE DATABASE...',
      'COMPUTING GEO-VELOCITY VECTORS...',
      'ANALYSIS COMPLETE. RENDERING THREAT MATRIX.',
    ];

    let msgIdx = 0;
    const logInterval = setInterval(() => {
      if (msgIdx < logMessages.length) {
        setScanLogs(prev => [...prev, logMessages[msgIdx]]);
        setScanProgress(Math.round(((msgIdx + 1) / logMessages.length) * 95));
        msgIdx++;
      }
    }, 400);

    try {
      const data = await action();
      clearInterval(logInterval);
      setScanProgress(100);
      setScanLogs(prev => [...prev, `FOUND ${data.anomalies.length} ANOMALIES. THREAT MATRIX READY.`]);
      await new Promise(r => setTimeout(r, 600));
      setResult(data);
      setSelectedAnomaly(data.anomalies[0] || null);
      setFilter('ALL');
    } catch (e: any) {
      clearInterval(logInterval);
      setError(e.message || 'Analysis failed');
    } finally {
      setScanning(false);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    runScan(() => analyzeFile(file));
  }, [runScan]);

  const handleDemo = useCallback(() => {
    runScan(async () => {
      const text = await loadDemoLog();
      return analyzeText(text);
    });
  }, [runScan]);

  const filteredAnomalies = result ? result.anomalies.filter(a => {
    if (filter === 'ALL') return true;
    if (filter === 'CRITICAL') return a.severity === 'critical';
    if (filter === 'HIGH') return a.severity === 'high';
    if (filter === 'MEDIUM') return a.severity === 'medium';
    if (filter === 'BRUTE FORCE') return a.type === 'brute_force';
    if (filter === 'GEO ANOMALY') return a.type === 'impossible_travel';
    return true;
  }) : [];

  return (
    <div className="flex flex-col h-screen overflow-hidden animate-crt">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-[#0d3320] bg-[#020d0a] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-DEFAULT animate-pulse" style={{ boxShadow: '0 0 6px #00ff88' }} />
            <span className="font-display text-green-DEFAULT text-glow-green text-sm font-bold tracking-widest">
              LOG-SENTINEL
            </span>
          </div>
          <span className="text-text-dim text-xs tracking-wider">AI THREAT DETECTION v1.0</span>
        </div>

        {result && (
          <MetricsBar summary={result.summary} />
        )}

        <div className="flex items-center gap-2 text-xs text-text-dim">
          <div className="w-1.5 h-1.5 rounded-full bg-green-DEFAULT animate-pulse" />
          <span>ONLINE</span>
          <span className="ml-2 text-text-muted">ML: ISOLATION FOREST</span>
        </div>
      </header>

      {/* Filter Bar */}
      {result && (
        <div className="flex-shrink-0 border-b border-[#0d3320] bg-[#041510] px-4 py-2 flex items-center gap-2">
          <span className="text-text-muted text-xs tracking-wider mr-2">FILTER:</span>
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'BRUTE FORCE', 'GEO ANOMALY'] as FilterType[]).map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
          <div className="ml-auto text-text-muted text-xs">
            {filteredAnomalies.length} THREAT{filteredAnomalies.length !== 1 ? 'S' : ''} SHOWN
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {!result ? (
          <UploadZone onFile={handleFile} onDemo={handleDemo} error={error} />
        ) : (
          <>
            {/* Left Sidebar */}
            <aside className="w-80 flex-shrink-0 border-r border-[#0d3320] flex flex-col overflow-hidden">
              <div className="flex-shrink-0 px-3 py-2 border-b border-[#0d3320] flex items-center justify-between">
                <span className="text-text-dim text-xs tracking-wider uppercase">Threat Queue</span>
                <button
                  onClick={() => { setResult(null); setSelectedAnomaly(null); }}
                  className="text-text-muted text-xs hover:text-green-DEFAULT transition-colors"
                >
                  [NEW SCAN]
                </button>
              </div>
              <AnomalyList
                anomalies={filteredAnomalies}
                selected={selectedAnomaly}
                onSelect={setSelectedAnomaly}
              />
            </aside>

            {/* Right Detail Panel */}
            <section className="flex-1 overflow-hidden">
              {selectedAnomaly ? (
                <AnomalyDetail
                  anomaly={selectedAnomaly}
                  hourlyActivity={result.hourly_activity}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted text-sm">
                  SELECT AN ANOMALY FROM THE QUEUE
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Scan Overlay */}
      {scanning && (
        <ScanOverlay progress={scanProgress} logs={scanLogs} />
      )}
    </div>
  );
}
