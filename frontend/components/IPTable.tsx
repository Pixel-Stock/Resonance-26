'use client';

import { Anomaly } from '../lib/types';

interface Props {
  anomaly: Anomaly;
}

const RISK_CATEGORIES: Record<string, { label: string; risk: string; color: string }> = {
  '185.220.101.': { label: 'Tor Exit Node', risk: 'CRITICAL', color: '#ff3355' },
  '45.142.212.': { label: 'Known Scanner (RU)', risk: 'HIGH', color: '#ffaa00' },
  '178.62.': { label: 'DigitalOcean (unwhitelisted)', risk: 'HIGH', color: '#ffaa00' },
  '41.203.': { label: 'Nigerian ISP', risk: 'MEDIUM', color: '#00d4ff' },
  '104.28.': { label: 'Cloudflare CDN', risk: 'LOW', color: '#5a9970' },
  '10.': { label: 'Internal Network', risk: 'INTERNAL', color: '#2d5540' },
  '192.168.': { label: 'LAN', risk: 'INTERNAL', color: '#2d5540' },
};

function getRiskInfo(ip: string) {
  for (const [prefix, info] of Object.entries(RISK_CATEGORIES)) {
    if (ip.startsWith(prefix)) return info;
  }
  return { label: 'Unknown', risk: 'UNKNOWN', color: '#5a9970' };
}

const DETAIL_GRID_FIELDS: Array<{ key: keyof Anomaly['metadata']; label: string }> = [
  { key: 'failure_ratio', label: 'FAILURE RATIO' },
  { key: 'req_count_5min', label: 'REQS / 5MIN' },
  { key: 'geo_velocity_kmh', label: 'GEO VELOCITY' },
  { key: 'port_diversity', label: 'PORT DIVERSITY' },
  { key: 'is_tor', label: 'TOR EXIT NODE' },
];

export default function IPTable({ anomaly }: Props) {
  const { metadata, source_ip, source_country, affected_user } = anomaly;
  const riskInfo = getRiskInfo(source_ip);

  return (
    <div className="p-3 flex flex-col gap-4">
      {/* IP Risk Panel */}
      <div>
        <div className="text-text-muted text-xs tracking-wider mb-2 border-b border-[#0d3320] pb-1">
          IP RISK ANALYSIS
        </div>

        <div
          className="p-2 border"
          style={{
            borderColor: riskInfo.color + '40',
            background: `${riskInfo.color}08`,
          }}
        >
          <div className="text-xs font-bold mb-1" style={{ color: '#00d4ff' }}>
            {source_ip}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-dim text-xs">{riskInfo.label}</span>
            <span
              className="text-xs font-bold px-2 py-0.5"
              style={{
                color: riskInfo.color,
                background: `${riskInfo.color}15`,
                border: `1px solid ${riskInfo.color}40`,
                fontSize: '9px',
                letterSpacing: '0.1em',
              }}
            >
              {riskInfo.risk}
            </span>
          </div>
          <div className="text-text-muted mt-1" style={{ fontSize: '9px' }}>
            GEO: {source_country}
          </div>
          {metadata.is_tor && (
            <div
              className="mt-1 text-xs"
              style={{ color: '#ff3355', fontSize: '9px' }}
            >
              ⚠ TOR EXIT NODE CONFIRMED
            </div>
          )}
        </div>
      </div>

      {/* ML Feature Grid */}
      <div>
        <div className="text-text-muted text-xs tracking-wider mb-2 border-b border-[#0d3320] pb-1">
          ML FEATURE VECTOR
        </div>
        <div className="flex flex-col gap-1">
          {DETAIL_GRID_FIELDS.map(field => {
            const val = metadata[field.key];
            const displayVal =
              typeof val === 'boolean'
                ? val ? 'YES' : 'NO'
                : typeof val === 'number'
                ? field.key === 'failure_ratio'
                  ? `${(val * 100).toFixed(1)}%`
                  : field.key === 'geo_velocity_kmh'
                  ? `${val.toLocaleString()} km/h`
                  : val.toLocaleString()
                : String(val);

            const isHigh =
              (field.key === 'failure_ratio' && (val as number) > 0.8) ||
              (field.key === 'geo_velocity_kmh' && (val as number) > 800) ||
              (field.key === 'port_diversity' && (val as number) > 100) ||
              (field.key === 'is_tor' && val === true);

            return (
              <div
                key={field.key}
                className="flex items-center justify-between py-1 border-b border-[#0a2010]"
              >
                <span className="text-text-muted" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>
                  {field.label}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color: isHigh ? '#ff3355' : '#c8ffe0', fontFamily: "'Share Tech Mono', monospace" }}
                >
                  {displayVal}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Affected User */}
      <div>
        <div className="text-text-muted text-xs tracking-wider mb-2 border-b border-[#0d3320] pb-1">
          AFFECTED IDENTITY
        </div>
        <div className="p-2 bg-[#071e15] border border-[#0d3320]">
          <div className="text-xs" style={{ color: '#00ff88' }}>{affected_user}</div>
          <div className="text-text-muted mt-0.5" style={{ fontSize: '9px' }}>
            {anomaly.event_count.toLocaleString()} EVENTS IN WINDOW
          </div>
        </div>
      </div>
    </div>
  );
}
