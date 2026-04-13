'use client';

interface Props {
  progress: number;
  logs: string[];
}

export default function ScanOverlay({ progress, logs }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center scan-overlay"
      style={{ backdropFilter: 'blur(2px)' }}
    >
      {/* Scanning beam */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute w-full h-0.5 animate-scan-sweep"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.6), transparent)',
            boxShadow: '0 0 20px rgba(0,255,136,0.4)',
          }}
        />
      </div>

      {/* Central card */}
      <div
        className="relative z-10 w-full max-w-lg p-8 border"
        style={{
          background: '#041510',
          borderColor: '#00ff88',
          boxShadow: '0 0 40px rgba(0,255,136,0.3), inset 0 0 40px rgba(0,255,136,0.03)',
        }}
      >
        {/* Title */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: '#00ff88', boxShadow: '0 0 10px #00ff88' }}
            />
            <span
              className="font-display text-green-DEFAULT text-glow-green text-lg tracking-widest font-bold"
              style={{ fontFamily: "'Orbitron', monospace" }}
            >
              SENTINEL SCAN
            </span>
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: '#00ff88', boxShadow: '0 0 10px #00ff88', animationDelay: '0.3s' }}
            />
          </div>
          <div className="text-text-muted text-xs tracking-widest">
            AI ANOMALY DETECTION ENGINE ACTIVE
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>ANALYZING...</span>
            <span style={{ color: '#00ff88' }}>{progress}%</span>
          </div>
          <div
            className="h-1.5 w-full"
            style={{ background: '#071e15', border: '1px solid #0d3320' }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #00ff88, #44ffaa)',
                boxShadow: '0 0 8px rgba(0,255,136,0.6)',
              }}
            />
          </div>
        </div>

        {/* Log output terminal */}
        <div
          className="h-40 overflow-y-auto p-3"
          style={{
            background: '#020d0a',
            border: '1px solid #0d3320',
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          {logs.map((log, i) => (
            <div
              key={i}
              className="text-xs mb-0.5"
              style={{ color: i === logs.length - 1 ? '#00ff88' : '#2d5540' }}
            >
              <span style={{ color: '#0d3320' }}>{String(i + 1).padStart(2, '0')} </span>
              {'> '}{log}
              {i === logs.length - 1 && (
                <span className="animate-blink" style={{ color: '#00ff88' }}>█</span>
              )}
            </div>
          ))}
        </div>

        {/* Bottom status */}
        <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
          <span>ISOLATION FOREST • 100 ESTIMATORS</span>
          <span style={{ color: '#00ff88' }}>GEMINI 1.5 FLASH READY</span>
        </div>
      </div>
    </div>
  );
}
