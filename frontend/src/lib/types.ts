export interface ParsedLog {
  timestamp: string;
  ip: string;
  user: string;
  action: string;
  status: string;
  port: number | null;
  raw: string;
}

export type ThreatType =
  | "BRUTE_FORCE"
  | "ACCOUNT_COMPROMISE"
  | "LATERAL_MOVEMENT"
  | "EXTERNAL_ACCESS"
  | "PERSISTENCE"
  | "PRIVILEGE_ESCALATION"
  | "SYSTEM_TAMPERING"
  | "UNKNOWN";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Anomaly {
  id: number;
  parsed_log: ParsedLog;
  isolation_score: number;
  threat_type: ThreatType;
  composite_score: number;
  threat_score: number;
  attack_chain: string[];
  severity: Severity;
}

export interface AIBriefing {
  executive_summary: string;
  technical_details: string;
  remediation_steps: string[];
}

export interface AnalysisResult {
  anomalies: Anomaly[];
  total_logs_parsed: number;
  total_anomalies: number;
  rule_flagged: number;
}

export type AnalysisState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "analyzing" }
  | { phase: "streaming_briefing"; result: AnalysisResult; briefingChunks: string }
  | { phase: "done"; result: AnalysisResult; briefing: AIBriefing }
  | { phase: "error"; message: string }
  | { phase: "live_monitoring"; anomalies: Anomaly[]; alertsFired: number; briefing: AIBriefing | null; briefingChunks: string };
