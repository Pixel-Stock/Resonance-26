"""
backend/ranker.py — Classifies and ranks anomalies for Log-Sentinel.
"""

import re
from typing import Optional
import numpy as np

# ---------------------------------------------------------------------------
# Severity thresholds
# ---------------------------------------------------------------------------

def classify_severity(score: float) -> str:
    if score >= 0.90:
        return "critical"
    if score >= 0.75:
        return "high"
    if score >= 0.60:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Anomaly type rules — applied on top of ML score
# ---------------------------------------------------------------------------

PRIVILEGE_ACCOUNTS = {"root", "admin", "postgres", "administrator", "sa"}
SENSITIVE_OPS = {"mysqldump", "pg_dump", "tar", "scp", "rsync", "exfil", "export"}


def _detect_type(features: dict, message: str, score: float) -> str:
    msg = message.lower()

    # Brute force: high failure ratio + many requests
    if features.get("failure_ratio", 0) > 0.9 and features.get("req_count_1min", 0) > 20:
        return "brute_force"

    # Impossible travel
    if features.get("geo_velocity_kmh", 0) > 800:
        return "impossible_travel"

    # Privilege escalation: sudo chain in message
    if any(kw in msg for kw in ("sudo", "su ", "su\t", "privilege", "escalat", "uid=0")):
        return "privilege_escalation"

    # Port scan: high port diversity + sequential pattern
    if features.get("port_diversity", 0) > 50 and features.get("sequential_port_pattern", 0):
        return "port_scan"

    # Data exfiltration
    if features.get("off_hours_sensitive_op", 0) and any(op in msg for op in SENSITIVE_OPS):
        return "data_exfiltration"

    # Default: generic
    return "anomaly"


TYPE_TAGS = {
    "brute_force": ["brute-force", "credential-stuffing", "auth-attack"],
    "impossible_travel": ["geo-anomaly", "impossible-travel", "account-compromise"],
    "privilege_escalation": ["privilege-escalation", "lateral-movement", "root-access"],
    "port_scan": ["port-scan", "reconnaissance", "network-probe"],
    "data_exfiltration": ["data-exfiltration", "off-hours", "insider-threat"],
    "anomaly": ["anomaly", "unknown-pattern"],
}

TYPE_TITLES = {
    "brute_force": "Mass Failed Logins — Brute Force",
    "impossible_travel": "Impossible Travel — Same Account, Different Continents",
    "privilege_escalation": "Privilege Escalation Chain Detected",
    "port_scan": "Port Scan — Reconnaissance Activity",
    "data_exfiltration": "Off-Hours Data Exfiltration Detected",
    "anomaly": "Suspicious Anomaly",
}


def _extract_user(message: str) -> Optional[str]:
    m = re.search(r'(?:for|user)\s+([\w.\-]+)', message.lower())
    return m.group(1) if m else None


def _extract_ip(message: str) -> Optional[str]:
    m = re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', message)
    return m.group() if m else None


GEO_MAP = {
    "185.220.101.": "NL (Tor exit)",
    "45.142.212.": "RU",
    "178.62.": "NL (DigitalOcean)",
    "41.203.": "NG",
    "104.28.": "US",
}


def _guess_country(ip: Optional[str]) -> str:
    if not ip:
        return "Unknown"
    for prefix, country in GEO_MAP.items():
        if ip.startswith(prefix):
            return country
    return "Unknown"


def rank_anomalies(
    parsed_logs: list[dict],
    feature_rows: list[dict],
    scores: np.ndarray,
    top_n: int = 5,
) -> list[dict]:
    """
    Given parallel lists of parsed_logs and feature_rows plus scores,
    return the top_n anomalies as enriched dicts ready for the API response.
    """
    if len(scores) == 0:
        return []

    # Sort indices by score descending
    ranked_indices = list(np.argsort(scores)[::-1])

    # Deduplicate by IP + type to avoid showing the same event 5 times
    seen_key: set = set()
    top_anomalies = []
    rank = 1

    for idx in ranked_indices:
        if rank > top_n * 3:  # look at 3× budget to find unique types
            break

        score = float(scores[idx])
        if score < 0.55:
            continue

        entry = parsed_logs[idx]
        feats = feature_rows[idx] if idx < len(feature_rows) else {}
        msg = entry.get("message", "")
        ip = entry.get("source_ip") or _extract_ip(msg)
        ts = entry.get("timestamp")

        atype = _detect_type(feats, msg, score)
        dedup_key = f"{atype}:{ip}"
        if dedup_key in seen_key:
            continue
        seen_key.add(dedup_key)

        severity = classify_severity(score)
        country = _guess_country(ip)
        user = _extract_user(msg) or "unknown"
        time_str = ts.strftime("%H:%M:%S") if ts else "??:??:??"

        # Collect the surrounding flagged raw log lines
        context_logs = []
        for j in range(max(0, idx - 2), min(len(parsed_logs), idx + 8)):
            ej = parsed_logs[j]
            sj = float(scores[j]) if j < len(scores) else 0
            t_j = ej.get("timestamp")
            context_logs.append({
                "timestamp": t_j.strftime("%H:%M:%S") if t_j else "??:??:??",
                "ip": ej.get("source_ip") or "",
                "message": ej.get("message", ej.get("raw_line", "")),
                "flagged": sj >= 0.55,
            })

        event_count_map = {
            "brute_force": feats.get("req_count_5min", 1) or 1,
            "port_scan": feats.get("port_diversity", 1) * 10 or 1,
            "impossible_travel": 2,
            "privilege_escalation": 4,
            "data_exfiltration": 1,
            "anomaly": 1,
        }
        event_count = event_count_map.get(atype, 1)

        top_anomalies.append({
            "rank": rank,
            "id": f"A{rank:03d}",
            "title": TYPE_TITLES.get(atype, "Anomaly"),
            "severity": severity,
            "score": round(score, 4),
            "type": atype,
            "tags": TYPE_TAGS.get(atype, ["anomaly"]),
            "source_ip": ip or "0.0.0.0",
            "source_country": country,
            "affected_user": user,
            "time_range": time_str,
            "event_count": event_count,
            "detail": msg[:300],
            "raw_logs": context_logs[:10],
            "metadata": {
                "failure_ratio": round(feats.get("failure_ratio", 0), 3),
                "req_count_5min": feats.get("req_count_5min", 0),
                "geo_velocity_kmh": round(feats.get("geo_velocity_kmh", 0), 1),
                "port_diversity": feats.get("port_diversity", 0),
                "is_tor": bool(feats.get("is_known_tor_exit", 0)),
            },
        })
        rank += 1
        if len(top_anomalies) >= top_n:
            break

    return top_anomalies
