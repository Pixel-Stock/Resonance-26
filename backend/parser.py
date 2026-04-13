"""
backend/parser.py — Log parser for Log-Sentinel.
Supports: auth.log, nginx access, apache access, syslog, generic timestamped.
"""

import re
from datetime import datetime
from typing import Optional
import calendar

# Regex patterns per log format
PATTERNS = {
    "auth_log": re.compile(
        r'(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>\S+)\s+(?P<host>\S+)\s+(?P<service>\S+):\s+(?P<message>.*)'
    ),
    "nginx_access": re.compile(
        r'(?P<ip>\S+)\s+-\s+-\s+\[(?P<time>[^\]]+)\]\s+"(?P<method>\S+)\s+(?P<path>\S+)\s+\S+"\s+(?P<status>\d+)\s+(?P<size>\d+)'
    ),
    "apache_access": re.compile(
        r'(?P<ip>\S+)\s+\S+\s+\S+\s+\[(?P<time>[^\]]+)\]\s+"(?P<request>[^"]+)"\s+(?P<status>\d+)'
    ),
    "syslog": re.compile(
        r'(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>\d{2}:\d{2}:\d{2})\s+(?P<host>\S+)\s+(?P<process>\S+)(?:\[(?P<pid>\d+)\])?:\s+(?P<message>.*)'
    ),
    "generic": re.compile(
        r'(?P<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\s+(?P<level>\w+)\s+(?P<message>.*)'
    ),
}

# Regex to extract IP addresses from message text
IP_RE = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')

# Month abbreviation → number
MONTH_MAP = {m: i for i, m in enumerate(calendar.month_abbr) if m}

CURRENT_YEAR = datetime.now().year


def _extract_ip(message: str) -> Optional[str]:
    """Pull first IPv4 address found in a log message."""
    match = IP_RE.search(message)
    return match.group() if match else None


def _parse_auth_time(month: str, day: str, time_str: str) -> Optional[datetime]:
    try:
        month_num = MONTH_MAP.get(month[:3].capitalize(), 1)
        return datetime.strptime(
            f"{CURRENT_YEAR}-{month_num:02d}-{int(day):02d} {time_str}", "%Y-%m-%d %H:%M:%S"
        )
    except Exception:
        return None


def _parse_generic_time(ts: str) -> Optional[datetime]:
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(ts, fmt)
        except ValueError:
            continue
    return None


def parse_line(line: str) -> dict:
    """
    Parse a single log line. Returns a dict with:
        timestamp   (datetime | None)
        source_ip   (str | None)
        message     (str)
        raw_line    (str)
        format      (str — which pattern matched)
    """
    raw = line.rstrip("\n")

    # auth_log / syslog share similar format — try auth first
    for fmt_name, pattern in PATTERNS.items():
        m = pattern.match(raw)
        if not m:
            continue

        groups = m.groupdict()
        message = groups.get("message") or groups.get("request") or raw
        source_ip = None

        if fmt_name == "auth_log":
            ts = _parse_auth_time(groups.get("month", ""), groups.get("day", ""), groups.get("time", ""))
            source_ip = _extract_ip(message)

        elif fmt_name == "syslog":
            ts = _parse_auth_time(groups.get("month", ""), groups.get("day", ""), groups.get("time", ""))
            source_ip = _extract_ip(message)

        elif fmt_name in ("nginx_access", "apache_access"):
            source_ip = groups.get("ip")
            ts = None  # bracket format parsing skipped for speed

        elif fmt_name == "generic":
            ts = _parse_generic_time(groups.get("timestamp", ""))
            source_ip = _extract_ip(message)

        else:
            ts = None

        return {
            "timestamp": ts,
            "source_ip": source_ip,
            "message": message,
            "raw_line": raw,
            "format": fmt_name,
        }

    # Fallback — return raw
    return {
        "timestamp": None,
        "source_ip": _extract_ip(raw),
        "message": raw,
        "raw_line": raw,
        "format": "unknown",
    }


def parse_log(text: str) -> list[dict]:
    """Parse all lines in a log text blob. Returns list of parsed dicts."""
    lines = text.splitlines()
    parsed = [parse_line(line) for line in lines if line.strip()]
    return parsed
