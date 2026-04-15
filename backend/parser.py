"""
Regex-based log parser supporting syslog, auth.log, Apache/Nginx access logs,
and a generic fallback. All timestamps normalized to UTC.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from schemas import ParsedLog

# ---------- Regex patterns ----------

# syslog / auth.log: "Apr 10 14:23:01 server sshd[12345]: Failed password for root from 192.168.1.1 port 22 ssh2"
_SYSLOG_RE = re.compile(
    r"(?P<timestamp>\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+"
    r"(?P<host>\S+)\s+"
    r"(?P<service>\S+?)(?:\[\d+\])?:\s+"
    r"(?P<message>.*)"
)

# Apache / Nginx combined: '192.168.1.1 - admin [10/Apr/2025:14:23:01 +0000] "GET /admin HTTP/1.1" 200 1234'
_ACCESS_RE = re.compile(
    r"(?P<ip>\d{1,3}(?:\.\d{1,3}){3})\s+"
    r"(?:\S+)\s+"
    r"(?P<user>\S+)\s+"
    r"\[(?P<timestamp>[^\]]+)\]\s+"
    r'"(?P<method>\w+)\s+(?P<path>\S+)\s+\S+"\s+'
    r"(?P<status>\d{3})\s+"
    r"(?P<bytes>\d+)"
)

# Generic: just look for an IP and a timestamp-like pattern
_GENERIC_IP_RE = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")
_GENERIC_TS_RE = re.compile(
    r"(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})"  # ISO-ish
    r"|(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})"     # syslog-style
)

# Patterns to extract auth-related info from syslog messages
_FAILED_PW_RE = re.compile(
    r"Failed password for (?:invalid user )?(?P<user>\S+) from (?P<ip>\S+)(?: port (?P<port>\d+))?"
)
_ACCEPTED_PW_RE = re.compile(
    r"Accepted (?:password|publickey) for (?P<user>\S+) from (?P<ip>\S+)(?: port (?P<port>\d+))?"
)
_SUDO_RE = re.compile(
    r"(?P<user>\S+)\s*:.*COMMAND=(?P<command>.*)"
)
_SESSION_RE = re.compile(
    r"session (?P<action>opened|closed) for user (?P<user>\S+)"
)
_PROMISCUOUS_RE = re.compile(
    r"device\s+\S+\s+entered\s+promiscuous\s+mode", re.IGNORECASE
)
_CRON_CMD_RE = re.compile(
    r"\((?P<cron_user>[^)]+)\)\s+CMD\s+\((?P<cmd>[^)]+)\)"
)


def _parse_syslog_timestamp(ts: str) -> datetime:
    """Parse 'Apr 10 14:23:01' — assumes current year, UTC."""
    now = datetime.now(timezone.utc)
    dt = datetime.strptime(ts, "%b %d %H:%M:%S").replace(year=now.year, tzinfo=timezone.utc)
    return dt


def _parse_access_timestamp(ts: str) -> datetime:
    """Parse '10/Apr/2025:14:23:01 +0000'."""
    try:
        return datetime.strptime(ts, "%d/%b/%Y:%H:%M:%S %z")
    except ValueError:
        return datetime.now(timezone.utc)


def _parse_iso_timestamp(ts: str) -> datetime:
    """Parse '2025-04-10T14:23:01' or '2025-04-10 14:23:01'."""
    ts = ts.replace("T", " ")
    try:
        return datetime.strptime(ts, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)


def _parse_syslog_line(line: str) -> ParsedLog | None:
    m = _SYSLOG_RE.match(line)
    if not m:
        return None

    ts = _parse_syslog_timestamp(m.group("timestamp"))
    host = m.group("host")
    message = m.group("message")
    ip = ""
    user = ""
    action = ""
    status = ""
    port = None

    # Try to extract structured info from the message
    fm = _FAILED_PW_RE.search(message)
    am = _ACCEPTED_PW_RE.search(message)
    sm = _SUDO_RE.search(message)
    sess = _SESSION_RE.search(message)
    prom = _PROMISCUOUS_RE.search(message)
    cron = _CRON_CMD_RE.search(message)

    if prom:
        action = "PROMISCUOUS_MODE"
        status = "critical"
    elif cron:
        user = cron.group("cron_user").strip()
        action = "CRON_JOB"
        status = "info"
    elif fm:
        ip = fm.group("ip")
        user = fm.group("user")
        action = "FAILED_LOGIN"
        status = "failure"
        port = int(fm.group("port")) if fm.group("port") else None
    elif am:
        ip = am.group("ip")
        user = am.group("user")
        action = "ACCEPTED_LOGIN"
        status = "success"
        port = int(am.group("port")) if am.group("port") else None
    elif sm:
        user = sm.group("user")
        action = "SUDO_COMMAND"
        status = "info"
    elif sess:
        user = sess.group("user")
        action = f"SESSION_{sess.group('action').upper()}"
        status = "info"
    else:
        action = m.group("service")
        # Try to grab an IP from the message
        ip_match = _GENERIC_IP_RE.search(message)
        if ip_match:
            ip = ip_match.group(1)

    return ParsedLog(
        timestamp=ts, ip=ip, user=user, host=host,
        action=action, status=status, port=port, raw=line.strip(),
    )


def _parse_access_line(line: str) -> ParsedLog | None:
    m = _ACCESS_RE.match(line)
    if not m:
        return None

    ts = _parse_access_timestamp(m.group("timestamp"))
    user = m.group("user") if m.group("user") != "-" else ""

    return ParsedLog(
        timestamp=ts,
        ip=m.group("ip"),
        user=user,
        action=f"{m.group('method')} {m.group('path')}",
        status=m.group("status"),
        raw=line.strip(),
    )


def _parse_generic_line(line: str) -> ParsedLog:
    """Fallback: extract whatever we can."""
    ip = ""
    ip_match = _GENERIC_IP_RE.search(line)
    if ip_match:
        ip = ip_match.group(1)

    ts = datetime.now(timezone.utc)
    ts_match = _GENERIC_TS_RE.search(line)
    if ts_match:
        if ts_match.group(1):
            ts = _parse_iso_timestamp(ts_match.group(1))
        elif ts_match.group(2):
            ts = _parse_syslog_timestamp(ts_match.group(2))

    return ParsedLog(
        timestamp=ts, ip=ip, user="", action="UNKNOWN",
        status="", raw=line.strip(),
    )


def parse_logs(raw_text: str) -> list[ParsedLog]:
    """Parse a block of raw log text into structured ParsedLog entries."""
    results: list[ParsedLog] = []
    for line in raw_text.splitlines():
        line = line.strip()
        if not line:
            continue

        # Try parsers in order of specificity
        parsed = _parse_access_line(line) or _parse_syslog_line(line)
        if parsed is None:
            parsed = _parse_generic_line(line)
        results.append(parsed)

    return results
