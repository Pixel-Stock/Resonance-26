"""
Rule-based threat classifier.

Runs AFTER the correlator. Assigns a ThreatType label based on:
  1. The attack_chain produced by the correlator (highest-priority signals first)
  2. Per-row feature values as fallback

The correlator handles scoring; this module handles labelling.
"""

from __future__ import annotations

import pandas as pd

from schemas import ThreatType


def _classify_from_chain_and_features(row: pd.Series) -> ThreatType:
    """Assign the single most descriptive ThreatType for this row."""
    chain: list[str] = row.get("attack_chain") or []
    chain_text = " ".join(chain).lower()
    action = str(row.get("action", "")).upper()
    raw = str(row.get("raw", "")).lower()

    failed = int(row.get("failed_logins_in_window", 0) or 0)
    unique_users = int(row.get("unique_users_in_window", 0) or 0)
    unique_ports = int(row.get("unique_ports_in_window", 0) or 0)
    sudo_cmds = int(row.get("sudo_commands_in_window", 0) or 0)
    unique_hosts = int(row.get("unique_hosts_for_user", 0) or 0)
    success_after = int(row.get("success_after_failures", 0) or 0)
    threat_score = int(row.get("threat_score", 0) or 0)

    # Priority order: most specific / most severe first

    # 1. Critical system events
    if action == "PROMISCUOUS_MODE" or "promiscuous" in chain_text:
        return ThreatType.CRITICAL_SYSTEM_EVENT

    # 2. Suspicious persistence (cron from /tmp)
    if action == "CRON_JOB" and ("/tmp/" in raw or "/var/tmp/" in raw):
        return ThreatType.SUSPICIOUS_PERSISTENCE
    if "persistence" in chain_text:
        return ThreatType.SUSPICIOUS_PERSISTENCE

    # 3. Lateral movement
    if unique_hosts >= 2 or "lateral movement" in chain_text:
        return ThreatType.LATERAL_MOVEMENT

    # 4. Account compromise (success after brute force)
    if action == "ACCEPTED_LOGIN" and success_after >= 5:
        return ThreatType.ACCOUNT_COMPROMISE
    if "account compromise" in chain_text:
        return ThreatType.ACCOUNT_COMPROMISE

    # 5. Privilege escalation
    if sudo_cmds >= 3 or (
        action == "SUDO_COMMAND" and ("root" in raw or "/bin/sh" in raw or "/bin/bash" in raw)
    ):
        return ThreatType.PRIVILEGE_ESCALATION
    if action == "ACCEPTED_LOGIN" and "privileged account" in chain_text:
        return ThreatType.PRIVILEGE_ESCALATION

    # 6. Brute force (covers failed login with count OR campaign pattern)
    if failed >= 5 or action == "FAILED_LOGIN":
        return ThreatType.BRUTE_FORCE
    if "brute force" in chain_text or "campaign" in chain_text:
        return ThreatType.BRUTE_FORCE

    # 7. Port scan
    if unique_ports >= 5:
        return ThreatType.PORT_SCAN

    # 8. Impossible travel (high-speed multi-user activity from one IP)
    epm = float(row.get("events_per_minute", 0) or 0)
    if epm >= 8 and failed >= 5:
        return ThreatType.IMPOSSIBLE_TRAVEL

    # 9. Any remaining scored event
    if threat_score > 0 or "denied" in raw or "unauthorized" in raw:
        return ThreatType.SUSPICIOUS_ACTIVITY

    return ThreatType.UNKNOWN


def classify_anomalies(df: pd.DataFrame) -> pd.DataFrame:
    """
    Classify all rows that have a threat_score > 0 OR were flagged by
    Isolation Forest (anomaly_label == -1).

    Adds a 'threat_type' column to every row (UNKNOWN for unconcerning events).
    """
    df = df.copy()
    df["threat_type"] = ThreatType.UNKNOWN.value

    # Classify anything the correlator scored OR that IF caught
    active_mask = (df.get("threat_score", 0) > 0) | (df["anomaly_label"] == -1)
    if active_mask.any():
        df.loc[active_mask, "threat_type"] = (
            df.loc[active_mask]
            .apply(_classify_from_chain_and_features, axis=1)
            .values
        )

    return df
