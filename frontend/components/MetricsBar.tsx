'use client';

import { AnalysisSummary } from '../lib/types';

interface Props {
  summary: AnalysisSummary;
}

export default function MetricsBar({ summary }: Props) {
  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="metric-card flex flex-col items-center min-w-[70px]">
        <span className="text-red-sentinel text-glow-red font-bold text-base">
          {summary.critical_count}
        </span>
        <span className="text-text-muted tracking-wider uppercase" style={{ fontSize: '9px' }}>CRITICAL</span>
      </div>
      <div className="metric-card flex flex-col items-center min-w-[70px]">
        <span className="text-amber-sentinel font-bold text-base">
          {summary.high_count}
        </span>
        <span className="text-text-muted tracking-wider uppercase" style={{ fontSize: '9px' }}>HIGH</span>
      </div>
      <div className="metric-card flex flex-col items-center min-w-[70px]">
        <span className="text-cyan-sentinel font-bold text-base">
          {summary.total_lines.toLocaleString()}
        </span>
        <span className="text-text-muted tracking-wider uppercase" style={{ fontSize: '9px' }}>LOG LINES</span>
      </div>
      <div className="metric-card flex flex-col items-center min-w-[70px]">
        <span className="text-green-DEFAULT font-bold text-base">
          {summary.unique_ips}
        </span>
        <span className="text-text-muted tracking-wider uppercase" style={{ fontSize: '9px' }}>UNIQUE IPs</span>
      </div>
      <div className="hidden lg:flex metric-card flex-col items-center min-w-[120px]">
        <span className="text-text font-bold text-xs">{summary.time_range}</span>
        <span className="text-text-muted tracking-wider uppercase" style={{ fontSize: '9px' }}>TIME RANGE</span>
      </div>
    </div>
  );
}
