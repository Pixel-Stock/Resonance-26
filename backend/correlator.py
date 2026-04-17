"""
Event correlation engine — detects multi-stage attack patterns across log events.
Behaves like a true SIEM correlator: emits disjoint, classified incidents for every rule matched.
"""

from __future__ import annotations

import math
import ipaddress
from datetime import timedelta
from typing import Any

import pandas as pd

from schemas import Anomaly, ParsedLog, Severity, ThreatType


def is_external_ip(ip: str) -> bool:
    if not ip: return False
    try: return ipaddress.ip_address(ip).is_global
    except ValueError: return False


def _build_anomaly(row: pd.Series, t_type: ThreatType, severity: Severity, score: int, chain: list[str]) -> Anomaly:
    """Helper to convert a pandas row into an Anomaly incident."""
    parsed = ParsedLog(
        timestamp=row["timestamp"],
        ip=str(row.get("ip", "") or ""),
        user=str(row.get("user", "") or ""),
        host=str(row.get("host", "") or ""),
        action=str(row.get("action", "") or ""),
        status=str(row.get("status", "") or ""),
        port=None if (p := row.get("port")) is None or (isinstance(p, float) and math.isnan(p)) else int(p),
        raw=str(row.get("raw", "") or ""),
    )
    iso_score = float(row.get("isolation_score", 0.0) or 0.0)
    
    return Anomaly(
        id=0,  # placeholder, set natively by ranker
        parsed_log=parsed,
        isolation_score=round(iso_score, 4),
        threat_type=t_type,
        composite_score=round(iso_score * 1.5 if score > 0 else iso_score, 4),
        threat_score=score,
        attack_chain=chain,
        severity=severity
    )


def correlate(df: pd.DataFrame) -> list[Anomaly]:
    """
    Evaluates raw events and returns isolated Anomaly incident objects.
    Produces MULTIPLE independent anomalies if different rules fire.
    """
    if df.empty:
        return []

    df = df.copy()
    df["is_ext"] = df["ip"].apply(is_external_ip)
    df["is_root"] = df["user"].str.lower().isin(["root", "administrator", "admin"])
    
    incidents: list[Anomaly] = []
    
    # Track used row indices so we don't duplicate Isolation Forest fallback
    rule_matched_indices = set()

    # Rule 1: System Tampering (Promiscuous Mode)
    tamper_mask = (df["action"] == "PROMISCUOUS_MODE") | df["raw"].str.lower().str.contains("promiscuous", na=False)
    for idx, row in df[tamper_mask].iterrows():
        incidents.append(_build_anomaly(row, ThreatType.SYSTEM_TAMPERING, Severity.CRITICAL, 9, ["Network interface placed in promiscuous mode (Sniffing)"]))
        rule_matched_indices.add(idx)

    # Rule 2: Persistence (Cron /tmp)
    cron_mask = (df["action"] == "CRON_JOB") & df["raw"].str.contains(r"/tmp/|/var/tmp/", na=False, regex=True)
    for idx, row in df[cron_mask].iterrows():
        incidents.append(_build_anomaly(row, ThreatType.PERSISTENCE, Severity.CRITICAL, 9, ["Suspicious persistence: cron job executing script from /tmp"]))
        rule_matched_indices.add(idx)

    # Rule 3: Brute Force & Account Compromise
    # We group by IP to evaluate brute force thresholds correctly.
    for ip, group in df[df["ip"].astype(str) != ""].groupby("ip"):
        failed_logins = group[group["action"] == "FAILED_LOGIN"]
        accepted_logins = group[group["action"] == "ACCEPTED_LOGIN"]
        
        fail_count = len(failed_logins)
        
        # Check Account Compromise first
        if fail_count > 20 and len(accepted_logins) > 0:
            # Did success happen AFTER failures? Ensure via chronological check.
            last_fail_ts = failed_logins["timestamp"].max()
            valid_successes = accepted_logins[accepted_logins["timestamp"] > last_fail_ts]
            if not valid_successes.empty:
                trigger_row = valid_successes.iloc[-1]
                incidents.append(_build_anomaly(
                    trigger_row, ThreatType.ACCOUNT_COMPROMISE, Severity.CRITICAL, 10,
                    [f"Account compromised: Successful login after {fail_count} failed attempts from {ip}"]
                ))
                rule_matched_indices.update(failed_logins.index)
                rule_matched_indices.update(valid_successes.index)
                continue # Skip reporting plain brute force if compromised
        
        # Check Brute Force heavily
        if fail_count > 30:
            trigger_row = failed_logins.iloc[-1]
            incidents.append(_build_anomaly(trigger_row, ThreatType.BRUTE_FORCE, Severity.CRITICAL, 8, [f"Critical Brute Force: {fail_count} failed logins from {ip}"]))
            rule_matched_indices.update(failed_logins.index)
        elif fail_count > 10:
            trigger_row = failed_logins.iloc[-1]
            incidents.append(_build_anomaly(trigger_row, ThreatType.BRUTE_FORCE, Severity.HIGH, 6, [f"High Brute Force: {fail_count} failed logins from {ip}"]))
            rule_matched_indices.update(failed_logins.index)
        elif fail_count > 5:
            trigger_row = failed_logins.iloc[-1]
            incidents.append(_build_anomaly(trigger_row, ThreatType.BRUTE_FORCE, Severity.MEDIUM, 4, [f"Brute Force Detected: {fail_count} failed logins from {ip}"]))
            rule_matched_indices.update(failed_logins.index)

    # Rule 4: Lateral Movement
    for user, group in df[(df["user"].astype(str) != "") & (df["action"] == "ACCEPTED_LOGIN")].groupby("user"):
        unique_hosts = group["host"].nunique()
        if unique_hosts >= 2:
            trigger_row = group.iloc[-1]
            incidents.append(_build_anomaly(
                trigger_row, ThreatType.LATERAL_MOVEMENT, Severity.HIGH, 7,
                [f"Lateral Movement: User '{user}' accessed {unique_hosts} different hosts rapidly"]
            ))
            rule_matched_indices.update(group.index)

    # Rule 5: External Access
    external_accesses = df[(df["is_ext"] == True) & (df["action"] == "ACCEPTED_LOGIN")]
    for ip, group in external_accesses.groupby("ip"):
        trigger_row = group.iloc[-1]
        is_root = bool(group["is_root"].any())
        failed_count = len(df[(df["ip"] == ip) & (df["action"] == "FAILED_LOGIN")])
        
        if failed_count > 5:
            incidents.append(_build_anomaly(trigger_row, ThreatType.EXTERNAL_ACCESS, Severity.CRITICAL, 9, [f"Critical External Access: Login from {ip} after brute force"]))
        elif is_root:
            incidents.append(_build_anomaly(trigger_row, ThreatType.EXTERNAL_ACCESS, Severity.HIGH, 7, [f"High External Access: Root login from external IP {ip}"]))
        else:
            incidents.append(_build_anomaly(trigger_row, ThreatType.EXTERNAL_ACCESS, Severity.MEDIUM, 5, [f"External Access: Successful login from external IP {ip}"]))
        rule_matched_indices.update(group.index)

    # Rule 6: Privilege Escalation
    sudo_mask = (df["action"] == "SUDO_COMMAND") & df["raw"].str.contains("root|/bin/bash|/bin/sh", case=False, na=False)
    for idx, row in df[sudo_mask].iterrows():
        incidents.append(_build_anomaly(row, ThreatType.PRIVILEGE_ESCALATION, Severity.HIGH, 7, [f"Privilege Escalation: Suspicious sudo command execution by '{row.get('user', 'unknown')}': {row.get('raw','')}"]))
        rule_matched_indices.add(idx)

    # Rule 7: Catch-All Isolation Forest Anomalies (that missed exact rules)
    if "anomaly_label" in df.columns:
        if_anomalies = df[(df["anomaly_label"] == -1) & (~df.index.isin(rule_matched_indices))]
        for idx, row in if_anomalies.iterrows():
            incidents.append(_build_anomaly(row, ThreatType.UNKNOWN, Severity.LOW, 1, ["Statistical outlier detected by Isolation Forest algorithm"]))

    return incidents
