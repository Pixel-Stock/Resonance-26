'use client';

import { useEffect, useState } from 'react';
import { Anomaly } from '../lib/types';

interface Props {
  anomaly: Anomaly;
  isSelected: boolean;
  onClick: () => void;
  delay: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff3355',
  high: '#ffaa00',
  medium: '#00d4ff',
  low: '#5a9970',
};

const TYPE_ICONS: Record<string, string> = {
  brute_force: '⚡',
  impossible_travel: '🌍',
  privilege_escalation: '⬆',
  port_scan: '🔍',
  data_exfiltration: '📤',
  anomaly: '⚠',
};

export default function AnomalyCard({ anomaly, isSelected, onClick, delay }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const color = SEVERITY_COLORS[anomaly.severity] || '#5a9970';
  const icon = TYPE_ICONS[anomaly.type] || '⚠';

  return (
    <button
      onClick={onClick}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(-10px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        borderLeft: isSelected ? `2px solid ${color}` : '2px solid transparent',
        background: isSelected ? `rgba(${color === '#ff3355' ? '255,51,85' : color === '#ffaa00' ? '255,170,0' : '0,212,255'}, 0.06)` : 'transparent',
      }}
      className="w-full text-left px-3 py-3 border-b border-[#0d3320] hover:bg-[#071e15] transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ fontSize: '12px' }}>{icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span
                className="text-xs font-bold tracking-wider"
                style={{ color: color, fontSize: '9px' }}
              >
                {anomaly.rank}. {anomaly.severity.toUpperCase()}
              </span>
            </div>
            <div className="text-text text-xs truncate" style={{ maxWidth: '200px' }}>
              {anomaly.title}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-xs font-bold" style={{ color }}>
            {(anomaly.score * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="score-bar-track mt-2 rounded-full overflow-hidden">
        <div
          className={`score-bar-fill-${anomaly.severity}`}
          style={{ width: `${anomaly.score * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-text-muted" style={{ fontSize: '9px' }}>
          {anomaly.source_ip}
        </span>
        <span className="text-text-muted" style={{ fontSize: '9px' }}>
          {anomaly.time_range}
        </span>
      </div>
    </button>
  );
}
