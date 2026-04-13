"""
backend/features.py — Feature engineering for Log-Sentinel anomaly detection.
Converts parsed log records into a numeric feature matrix for Isolation Forest.
"""

import ipaddress
import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Known Tor exit CIDR ranges (hardcoded subset for hackathon)
# ---------------------------------------------------------------------------
TOR_EXIT_CIDRS = [
    "185.220.101.0/24",
    "185.220.102.0/24",
    "185.220.100.0/24",
    "199.249.230.0/24",
    "162.247.74.0/24",
    "185.107.57.0/24",
]
_TOR_NETS = [ipaddress.ip_network(c, strict=False) for c in TOR_EXIT_CIDRS]

# Known Russian scanner ranges
SCANNER_CIDRS = ["45.142.212.0/24", "45.142.213.0/24"]
_SCANNER_NETS = [ipaddress.ip_network(c, strict=False) for c in SCANNER_CIDRS]

# Geo-IP mock: IP prefix → (country, lat, lon)
GEO_MOCK = {
    "104.28.": ("US", 37.7749, -122.4194),     # San Francisco
    "41.203.": ("NG", 6.5244, 3.3792),          # Lagos
    "185.220.101.": ("NL", 52.3676, 4.9041),    # TOR/NL
    "178.62.": ("NL", 52.3676, 4.9041),         # DigitalOcean NL
    "45.142.212.": ("RU", 55.7558, 37.6173),    # RU scanner
    "192.168.": ("internal", 0.0, 0.0),
    "10.": ("internal", 0.0, 0.0),
}

# Whitelisted egress IPs (do NOT flag outbound to these)
WHITELISTED_IPS = {"8.8.8.8", "8.8.4.4", "1.1.1.1"}

PRIVILEGE_ACCOUNTS = {"root", "admin", "postgres", "administrator", "sa"}
SENSITIVE_OPS = {"mysqldump", "pg_dump", "tar", "scp", "rsync", "exfil", "export"}


def _geo_lookup(ip: Optional[str]):
    """Returns (country, lat, lon) or None."""
    if not ip:
        return None
    for prefix, geo in GEO_MOCK.items():
        if ip.startswith(prefix):
            return geo
    return None


def _is_tor(ip: Optional[str]) -> bool:
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
        return any(addr in net for net in _TOR_NETS)
    except ValueError:
        return False


def _is_internal(ip: Optional[str]) -> bool:
    if not ip:
        return False
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return False


def _geo_velocity_kmh(geo1, geo2, dt_hours: float) -> float:
    """Haversine-based speed in km/h between two geo points."""
    if geo1 is None or geo2 is None or dt_hours <= 0:
        return 0.0
    import math
    lat1, lon1 = math.radians(geo1[1]), math.radians(geo1[2])
    lat2, lon2 = math.radians(geo2[1]), math.radians(geo2[2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    dist_km = 6371 * 2 * math.asin(math.sqrt(a))
    return dist_km / dt_hours


PORT_RE = re.compile(r'port (\d+)')


def engineer_features(parsed_logs: list[dict]) -> pd.DataFrame:
    """
    Accepts a list of parsed log dicts. Returns a DataFrame where each row
    corresponds to a parsed log entry enriched with ML-ready features.
    """
    if not parsed_logs:
        return pd.DataFrame()

    records = []

    # Build per-IP windows in one pass
    ip_events: dict[str, list] = defaultdict(list)
    ip_ports: dict[str, list] = defaultdict(list)
    ip_users: dict[str, set] = defaultdict(set)
    ip_failures: dict[str, int] = defaultdict(int)
    ip_successes: dict[str, int] = defaultdict(int)
    user_logins: dict[str, list] = defaultdict(list)  # user → [(ts, ip, geo)]

    for entry in parsed_logs:
        ip = entry.get("source_ip")
        ts = entry.get("timestamp")
        msg = entry.get("message", "")
        msg_lower = msg.lower()

        if ip and ts:
            ip_events[ip].append(ts)

        # Port extraction
        pm = PORT_RE.search(msg)
        if pm and ip:
            ip_ports[ip].append(int(pm.group(1)))

        # User extraction from auth messages
        user_m = re.search(r'(?:for|user)\s+(\w[\w.\-]+)', msg_lower)
        user = user_m.group(1) if user_m else None
        if user and ip:
            ip_users[ip].add(user)

        # Failure vs success
        if ip:
            if any(kw in msg_lower for kw in ("failed", "failure", "invalid", "error")):
                ip_failures[ip] += 1
            elif any(kw in msg_lower for kw in ("accepted", "success", "logged in", "opened")):
                ip_successes[ip] += 1

        # Track user logins for impossible travel
        if user and ts and ip:
            geo = _geo_lookup(ip)
            user_logins[user].append((ts, ip, geo))

    # Build geo-velocity per-user
    user_max_velocity: dict[str, float] = {}
    for user, events in user_logins.items():
        events_sorted = sorted(events, key=lambda x: x[0])
        max_v = 0.0
        for i in range(1, len(events_sorted)):
            ts1, ip1, geo1 = events_sorted[i - 1]
            ts2, ip2, geo2 = events_sorted[i]
            dt = (ts2 - ts1).total_seconds() / 3600
            v = _geo_velocity_kmh(geo1, geo2, dt)
            max_v = max(max_v, v)
        user_max_velocity[user] = max_v

    # Now build feature rows
    for i, entry in enumerate(parsed_logs):
        ip = entry.get("source_ip")
        ts: Optional[datetime] = entry.get("timestamp")
        msg = entry.get("message", "")
        msg_lower = msg.lower()

        hour = ts.hour if ts else 12
        off_hours = int(0 <= hour < 6)

        # 1-min and 5-min request counts
        req_1min = req_5min = 0
        if ip and ts:
            t1 = ts - timedelta(minutes=1)
            t5 = ts - timedelta(minutes=5)
            events = ip_events[ip]
            req_1min = sum(1 for t in events if t1 <= t <= ts)
            req_5min = sum(1 for t in events if t5 <= t <= ts)

        # Failure ratio
        fail = ip_failures.get(ip, 0)
        succ = ip_successes.get(ip, 0)
        failure_ratio = fail / (fail + succ + 1e-9)

        # Unique users targeted
        unique_users_targeted = len(ip_users.get(ip, set()))

        # Port diversity
        ports = ip_ports.get(ip, [])
        port_diversity = len(set(ports))

        # Sequential port pattern (monotonically increasing in last 50 ports)
        sequential_port = False
        if len(ports) >= 5:
            recent = ports[-50:]
            sequential_port = all(recent[j] < recent[j + 1] for j in range(len(recent) - 1))

        # Privilege account targeted
        privilege_targeted = any(u in PRIVILEGE_ACCOUNTS for u in ip_users.get(ip, set()))
        priv_in_msg = any(p in msg_lower for p in PRIVILEGE_ACCOUNTS)

        # Geo velocity for the user associated with this line
        user_m = re.search(r'(?:for|user)\s+(\w[\w.\-]+)', msg_lower)
        user = user_m.group(1) if user_m else None
        geo_velocity = user_max_velocity.get(user, 0.0) if user else 0.0

        # Off-hours sensitive op
        sensitive_op = any(op in msg_lower for op in SENSITIVE_OPS)
        off_hours_sensitive = int(off_hours and sensitive_op)

        # Inter-request delta (avg ms between consecutive events for IP)
        inter_delta_ms = 0.0
        if ip:
            ev = sorted(ip_events[ip])
            if len(ev) >= 2:
                deltas = [(ev[j + 1] - ev[j]).total_seconds() * 1000 for j in range(len(ev) - 1)]
                inter_delta_ms = sum(deltas) / len(deltas)

        # Request burst (30-second window)
        burst = 0
        if ip and ts:
            t30 = ts - timedelta(seconds=30)
            burst = sum(1 for t in ip_events[ip] if t30 <= t <= ts)

        records.append({
            "idx": i,
            "req_count_1min": req_1min,
            "req_count_5min": req_5min,
            "failure_ratio": failure_ratio,
            "unique_users_targeted": unique_users_targeted,
            "hour_of_day": hour,
            "inter_req_delta_ms": inter_delta_ms,
            "request_burst": burst,
            "is_known_tor_exit": int(_is_tor(ip)),
            "is_internal_ip": int(_is_internal(ip)),
            "geo_velocity_kmh": min(geo_velocity, 20000.0),  # cap for normalization
            "port_diversity": port_diversity,
            "privilege_account_targeted": int(privilege_targeted or priv_in_msg),
            "sequential_port_pattern": int(sequential_port),
            "off_hours_sensitive_op": off_hours_sensitive,
        })

    df = pd.DataFrame(records).set_index("idx")
    return df
