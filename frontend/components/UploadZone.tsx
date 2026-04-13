'use client';

import { useCallback, useRef, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
  onDemo: () => void;
  error: string | null;
}

export default function UploadZone({ onFile, onDemo, error }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-[#020d0a]">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="font-display text-4xl font-black tracking-[0.3em] text-green-DEFAULT text-glow-green mb-2">
            LOG-SENTINEL
          </div>
          <div className="text-text-dim text-sm tracking-[0.2em]">
            AI-POWERED SECURITY LOG ANOMALY DETECTION
          </div>
          <div className="flex items-center justify-center gap-6 mt-3 text-text-muted text-xs">
            <span>ISOLATION FOREST ML</span>
            <span style={{ color: '#0d3320' }}>|</span>
            <span>GEMINI 1.5 FLASH</span>
            <span style={{ color: '#0d3320' }}>|</span>
            <span>5 ANOMALY TYPES</span>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          className={`upload-zone p-10 text-center cursor-pointer ${dragging ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".log,.txt"
            onChange={handleChange}
            className="hidden"
            id="log-file-input"
          />
          <div className="text-4xl mb-4">📁</div>
          <div className="text-text text-sm tracking-wider mb-2">
            DRAG & DROP LOG FILE
          </div>
          <div className="text-text-muted text-xs mb-4">
            Supports: auth.log, nginx access, Apache, syslog, generic timestamp format
          </div>
          <div className="border border-[#1a5535] px-4 py-2 inline-block text-text-dim text-xs tracking-wider hover:border-green-DEFAULT hover:text-green-DEFAULT transition-all">
            BROWSE FILE
          </div>
        </div>

        {/* Demo Button */}
        <div className="mt-4 text-center">
          <button
            id="load-demo-btn"
            onClick={onDemo}
            className="px-8 py-3 border-2 text-sm tracking-widest font-bold transition-all"
            style={{
              borderColor: '#00ff88',
              color: '#00ff88',
              background: 'rgba(0,255,136,0.06)',
              fontFamily: "'Orbitron', monospace",
              letterSpacing: '0.2em',
              boxShadow: '0 0 20px rgba(0,255,136,0.2)',
            }}
            onMouseEnter={e => {
              (e.target as HTMLElement).style.boxShadow = '0 0 40px rgba(0,255,136,0.4)';
              (e.target as HTMLElement).style.background = 'rgba(0,255,136,0.12)';
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.boxShadow = '0 0 20px rgba(0,255,136,0.2)';
              (e.target as HTMLElement).style.background = 'rgba(0,255,136,0.06)';
            }}
          >
            ► LOAD DEMO SCENARIO
          </button>
          <div className="text-text-muted text-xs mt-2">
            8,000+ line log with 5 embedded attack scenarios
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mt-4 p-3 border text-xs text-center"
            style={{
              borderColor: '#ff3355',
              background: 'rgba(255,51,85,0.08)',
              color: '#ff3355',
              letterSpacing: '0.05em',
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* Feature grid */}
        <div className="grid grid-cols-3 gap-3 mt-8">
          {[
            { icon: '⚡', label: 'BRUTE FORCE', desc: 'Mass auth attempts from Tor exits' },
            { icon: '🌍', label: 'IMPOSSIBLE TRAVEL', desc: 'Same user, different continents' },
            { icon: '⬆', label: 'PRIV ESCALATION', desc: 'www-data → root via sudo chain' },
            { icon: '🔍', label: 'PORT SCAN', desc: 'SYN flood reconnaissance activity' },
            { icon: '📤', label: 'DATA EXFIL', desc: 'Off-hours DB dump to foreign IP' },
            { icon: '🤖', label: 'AI BRIEFING', desc: 'Gemini generates expert analysis' },
          ].map(f => (
            <div
              key={f.label}
              className="p-3 border border-[#0d3320] bg-[#041510] text-center"
            >
              <div className="text-xl mb-1">{f.icon}</div>
              <div className="text-green-DEFAULT text-xs tracking-wider font-bold mb-0.5" style={{ fontSize: '9px' }}>
                {f.label}
              </div>
              <div className="text-text-muted leading-relaxed" style={{ fontSize: '9px' }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
