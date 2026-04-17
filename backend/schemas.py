"""
Pydantic models for request validation and response serialization.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ThreatType(str, Enum):
    BRUTE_FORCE = "BRUTE_FORCE"
    ACCOUNT_COMPROMISE = "ACCOUNT_COMPROMISE"
    LATERAL_MOVEMENT = "LATERAL_MOVEMENT"
    EXTERNAL_ACCESS = "EXTERNAL_ACCESS"
    PERSISTENCE = "PERSISTENCE"
    PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION"
    SYSTEM_TAMPERING = "SYSTEM_TAMPERING"
    UNKNOWN = "UNKNOWN"


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ParsedLog(BaseModel):
    timestamp: datetime
    ip: str = ""
    user: str = ""
    host: str = ""
    action: str = ""
    status: str = ""
    port: int | None = None
    raw: str = ""


class Anomaly(BaseModel):
    id: int
    parsed_log: ParsedLog
    isolation_score: float = Field(description="Raw Isolation Forest anomaly score (more negative = more anomalous)")
    threat_type: ThreatType = ThreatType.UNKNOWN
    composite_score: float = Field(default=0.0, description="isolation_score × threat_weight")
    threat_score: int = Field(default=0, description="Rule-based threat score (0-2 Low, 3-5 Med, 6-8 High, 9+ Critical)")
    attack_chain: list[str] = Field(default_factory=list, description="Labels describing each scoring rule that fired")
    severity: Severity = Severity.LOW


class AIBriefing(BaseModel):
    executive_summary: str = ""          # ONE sentence — what happened
    threat_type_label: str = ""          # e.g. "Brute Force + Account Compromise"
    risk_level: str = ""                 # CRITICAL / HIGH / MEDIUM / LOW
    time_range: str = ""                 # e.g. "18:22 – 18:45 UTC"
    affected_hosts: list[str] = Field(default_factory=list)   # chip tags
    key_facts: dict[str, str] = Field(default_factory=dict)   # key-value technical table
    technical_details: str = ""          # kept for fallback
    remediation_steps: list[str] = Field(default_factory=list)


class AnalyzeParams(BaseModel):
    contamination: float = Field(default=0.03, ge=0.001, le=0.5)
    top_n: int = Field(default=10, ge=1, le=100)


class SSEEvent(BaseModel):
    """Shape of each SSE event sent to the frontend."""
    event: str  # "anomalies" | "briefing_chunk" | "briefing_done" | "error"
    data: dict | list | str
