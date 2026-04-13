'use client';

import { RawLogEntry } from '../lib/types';

interface Props {
  logs: RawLogEntry[];
  detail: string;
}

export default function LogViewer({ logs, detail }: Props) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Detail summary */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-[#0d3320] bg-[#041510]">
        <div className="text-text-muted text-xs tracking-wider mb-1">TECHNICAL SUMMARY</div>
        <div className="text-text text-xs leading-relaxed" style={{ color: '#c8ffe0' }}>
          {detail}
        </div>
      </div>

      {/* Log lines */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-text-muted text-xs tracking-wider px-2 py-1 border-b border-[#0d3320] mb-1">
          LOG EVIDENCE — {logs.length} ENTRIES
        </div>
        {logs.map((log, i) => (
          <div
            key={i}
            className={log.flagged ? 'log-line-flagged' : 'log-line-normal'}
            style={{ fontSize: '11px', lineHeight: '1.8', fontFamily: "'Share Tech Mono', monospace" }}
          >
            <span style={{ color: '#2d5540', userSelect: 'none', marginRight: '8px' }}>
              {String(i + 1).padStart(3, '0')}
            </span>
            {log.timestamp && (
              <span style={{ color: '#5a9970', marginRight: '8px' }}>{log.timestamp}</span>
            )}
            {log.ip && (
              <span style={{ color: '#00d4ff', marginRight: '8px' }}>[{log.ip}]</span>
            )}
            <span className={log.flagged ? 'text-red-sentinel' : 'text-text-dim'}>
              {log.message}
            </span>
            {log.flagged && (
              <span
                style={{
                  color: '#ff3355',
                  fontSize: '9px',
                  marginLeft: '8px',
                  background: 'rgba(255,51,85,0.15)',
                  padding: '1px 4px',
                  letterSpacing: '0.05em',
                }}
              >
                ◄ FLAGGED
              </span>
            )}
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-text-muted text-xs text-center py-8">
            NO RAW LOG EVIDENCE AVAILABLE
          </div>
        )}
      </div>
    </div>
  );
}
