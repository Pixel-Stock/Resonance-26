'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { HourlyActivity } from '../lib/types';

interface Props {
  data: HourlyActivity[];
  anomalyType: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: '#041510',
          border: '1px solid #0d3320',
          padding: '8px 12px',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '11px',
        }}
      >
        <div style={{ color: '#5a9970', marginBottom: '4px' }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name.toUpperCase()}: {p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function TimelineChart({ data, anomalyType }: Props) {
  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-text-muted text-xs tracking-wider">24-HOUR ACTIVITY TIMELINE</div>
          <div className="text-text-dim text-xs mt-0.5">
            EVENT DENSITY — NORMAL / WARNING / ANOMALOUS
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span style={{ color: '#00ff88' }}>● NORMAL</span>
          <span style={{ color: '#ffaa00' }}>● WARNING</span>
          <span style={{ color: '#ff3355' }}>● ANOMALOUS</span>
        </div>
      </div>

      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00ff88" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorWarning" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffaa00" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ffaa00" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorAnomalous" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff3355" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ff3355" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#0d3320"
              vertical={false}
            />
            <XAxis
              dataKey="hour"
              tick={{ fill: '#2d5540', fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }}
              tickLine={false}
              axisLine={{ stroke: '#0d3320' }}
              interval={3}
            />
            <YAxis
              tick={{ fill: '#2d5540', fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="normal"
              stroke="#00ff88"
              strokeWidth={1.5}
              fill="url(#colorNormal)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="warning"
              stroke="#ffaa00"
              strokeWidth={1.5}
              fill="url(#colorWarning)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="anomalous"
              stroke="#ff3355"
              strokeWidth={2}
              fill="url(#colorAnomalous)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-text-muted text-xs text-center">
        SPIKE INDICATES TIME WINDOW OF DETECTED ANOMALY
      </div>
    </div>
  );
}
