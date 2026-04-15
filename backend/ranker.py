"""
Severity ranking — uses rule-based threat_score as primary signal,
Isolation Forest composite score as secondary tiebreaker.
"""

from __future__ import annotations

import math

import pandas as pd

from config import DEFAULT_TOP_N, THREAT_WEIGHTS
from schemas import Anomaly, ParsedLog, Severity, ThreatType


def rank_anomalies(anomalies: list[Anomaly], top_n: int = DEFAULT_TOP_N) -> list[Anomaly]:
    """
    Sort independent incident objects by severity/score descending and return the top_n.
    """
    if not anomalies:
        return []

    # Map Severity enum to an integer for sorting (CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1)
    def severity_val(sev: Severity) -> int:
        if sev == Severity.CRITICAL: return 4
        if sev == Severity.HIGH: return 3
        if sev == Severity.MEDIUM: return 2
        return 1

    # Sort descending by Severity, then threat_score, then composite_score
    anomalies.sort(key=lambda a: (severity_val(a.severity), a.threat_score, a.composite_score), reverse=True)

    # Assign sequential IDs and take top N
    results = []
    for idx, a in enumerate(anomalies[:top_n]):
        a.id = idx + 1
        results.append(a)

    return results
