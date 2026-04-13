'use client';

import { useState } from 'react';
import { Anomaly, HourlyActivity } from '../lib/types';
import LogViewer from './LogViewer';
import TimelineChart from './TimelineChart';
import IPTable from './IPTable';
import AIBriefing from './AIBriefing';

interface Props {
  anomaly: Anomaly;
  hourlyActivity: HourlyActivity[];
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff3355',
  high: '#ffaa00',
  medium: '#00d4ff',
  low: '#5a9970',
};

const TYPE_LABELS: Record<string, string> = {
  brute_force: 'BRUTE FORCE',
  impossible_travel: 'IMPOSSIBLE TRAVEL',
  privilege_escalation: 'PRIVILEGE ESCALATION',
  port_scan: 'PORT SCAN',
  data_exfiltration: 'DATA EXFILTRATION',
  anomaly: 'ANOMALY',
};

export default function AnomalyDetail({ anomaly, hourlyActivity }: Props) {
  const [tab, setTab] = useState<'logs' | 'timeline' | 'briefing'>('logs');
  const color = SEVERITY_COLORS[anomaly.severity] || '#5a9970';

  return (
    <div className="h-full flex flex-col overflow-hidden animate-slide-in">
      {/* Anomaly Header */}
      <div className="flex-shrink-0 border-b border-[#0d3320] px-4 py-3 bg-[#041510]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span
                className="text-xs tracking-widest uppercase font-bold"
                style={{ color, textShadow: `0 0 10px ${color}80` }}
              >
                [{anomaly.id}] {anomaly.severity.toUpperCase()}
              </span>
              <span
                className="text-xs px-2 py-0.5 border tracking-wider"
                style={{ color: '#5a9970', borderColor: '#0d3320', fontSize: '9px' }}
              >
                {TYPE_LABELS[anomaly.type] || anomaly.type}
              </span>
            </div>
            <h1
              className="text-base font-bold tracking-wide"
              style={{ color, fontFamily: "'Orbitron', monospace" }}
            >
              {anomaly.title}
            </h1>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold" style={{ color, fontFamily: "'Orbitron', monospace" }}>
              {(anomaly.score * 100).toFixed(1)}%
            </div>
            <div className="text-text-muted text-xs tracking-wider">THREAT SCORE</div>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-4 gap-3 mt-3">
          {[
            { label: 'SOURCE IP', value: anomaly.source_ip, color: '#00d4ff' },
            { label: 'COUNTRY', value: anomaly.source_country, color: '#c8ffe0' },
            { label: 'USER', value: anomaly.affected_user, color: '#c8ffe0' },
            { label: 'EVENTS', value: anomaly.event_count.toLocaleString(), color: color },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div className="text-text-muted tracking-wider mb-0.5" style={{ fontSize: '9px' }}>
                {m.label}
              </div>
              <div className="font-bold text-xs truncate" style={{ color: m.color }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-2">
          {anomaly.tags.map(tag => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 border"
              style={{
                color: '#5a9970',
                borderColor: '#0d3320',
                background: 'rgba(0,255,136,0.03)',
                fontSize: '9px',
                letterSpacing: '0.05em',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex-shrink-0 border-b border-[#0d3320] flex">
        {([
          { id: 'logs', label: 'RAW LOG EVIDENCE' },
          { id: 'timeline', label: '24H ACTIVITY' },
          { id: 'briefing', label: 'AI BRIEFING' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 text-xs tracking-wider border-r border-[#0d3320] transition-all"
            style={{
              color: tab === t.id ? '#00ff88' : '#5a9970',
              background: tab === t.id ? 'rgba(0,255,136,0.06)' : 'transparent',
              borderBottom: tab === t.id ? '2px solid #00ff88' : '2px solid transparent',
              fontFamily: "'Share Tech Mono', monospace",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex">
        {tab === 'logs' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <LogViewer logs={anomaly.raw_logs} detail={anomaly.detail} />
            </div>
            <div className="w-72 flex-shrink-0 border-l border-[#0d3320] overflow-y-auto">
              <IPTable anomaly={anomaly} />
            </div>
          </div>
        )}
        {tab === 'timeline' && (
          <div className="flex-1 overflow-hidden">
            <TimelineChart data={hourlyActivity} anomalyType={anomaly.type} />
          </div>
        )}
        {tab === 'briefing' && (
          <div className="flex-1 overflow-hidden">
            <AIBriefing anomaly={anomaly} />
          </div>
        )}
      </div>
    </div>
  );
}
