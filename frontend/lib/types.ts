// frontend/lib/types.ts — Shared TypeScript types for Log-Sentinel

export interface RawLogEntry {
  timestamp: string;
  ip: string;
  message: string;
  flagged: boolean;
}

export interface AnomalyMetadata {
  failure_ratio: number;
  req_count_5min: number;
  geo_velocity_kmh: number;
  port_diversity: number;
  is_tor: boolean;
}

export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';
export type AnomalyType =
  | 'brute_force'
  | 'impossible_travel'
  | 'privilege_escalation'
  | 'port_scan'
  | 'data_exfiltration'
  | 'anomaly';

export interface Anomaly {
  rank: number;
  id: string;
  title: string;
  severity: AnomalySeverity;
  score: number;
  type: AnomalyType;
  tags: string[];
  source_ip: string;
  source_country: string;
  affected_user: string;
  time_range: string;
  event_count: number;
  detail: string;
  raw_logs: RawLogEntry[];
  metadata: AnomalyMetadata;
}

export interface HourlyActivity {
  hour: string;
  normal: number;
  anomalous: number;
  warning: number;
}

export interface AnalysisSummary {
  total_lines: number;
  unique_ips: number;
  time_range: string;
  critical_count: number;
  high_count: number;
  anomalies_found: number;
}

export interface AnalysisResult {
  summary: AnalysisSummary;
  anomalies: Anomaly[];
  hourly_activity: HourlyActivity[];
}

export type FilterType = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'BRUTE FORCE' | 'GEO ANOMALY';
