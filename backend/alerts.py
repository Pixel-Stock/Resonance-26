"""
Alert module — fires email (Gmail SMTP) and Telegram Bot notifications
when a CRITICAL or HIGH severity threat is detected in live monitoring mode.
"""

from __future__ import annotations

import json
import os
import smtplib
import ssl
import urllib.request
import urllib.parse
from datetime import datetime
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from schemas import Anomaly

GMAIL_USER = os.getenv("ALERT_EMAIL_FROM", "")
GMAIL_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "")
ALERT_TO = os.getenv("ALERT_EMAIL_TO", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_GROUP_CHAT_ID = os.getenv("TELEGRAM_GROUP_CHAT_ID", "")

_SEVERITY_COLORS = {
    "CRITICAL": "#dc2626",
    "HIGH":     "#ea580c",
    "MEDIUM":   "#d97706",
    "LOW":      "#65a30d",
}

_SEVERITY_EMOJI = {
    "CRITICAL": "🔴",
    "HIGH":     "🟠",
    "MEDIUM":   "🟡",
    "LOW":      "🟢",
}


def _build_email_html(anomaly: Anomaly) -> str:
    color = _SEVERITY_COLORS.get(anomaly.severity, "#6b7280")
    ts = anomaly.parsed_log.timestamp if hasattr(anomaly.parsed_log, "timestamp") else "unknown"
    ip = anomaly.parsed_log.ip or "unknown"
    action = anomaly.parsed_log.action or "unknown"
    user = anomaly.parsed_log.user or "-"

    return f"""
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f8fafc;padding:32px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;
              box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden">
    <div style="background:{color};padding:20px 28px">
      <h1 style="color:#fff;margin:0;font-size:20px">
        ⚠️ Log Sentinel — Threat Detected
      </h1>
    </div>
    <div style="padding:28px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;width:40%">Severity</td>
          <td style="padding:8px 0">
            <span style="background:{color};color:#fff;padding:3px 10px;
                         border-radius:999px;font-size:12px;font-weight:600">
              {anomaly.severity}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px">Threat Type</td>
          <td style="padding:8px 0;font-weight:600;font-size:14px;color:#1e293b">
            {anomaly.threat_type}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px">Source IP</td>
          <td style="padding:8px 0;font-family:monospace;color:#1e293b">{ip}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px">User</td>
          <td style="padding:8px 0;font-family:monospace;color:#1e293b">{user}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px">Action</td>
          <td style="padding:8px 0;font-family:monospace;color:#1e293b">{action}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px">Timestamp</td>
          <td style="padding:8px 0;font-size:13px;color:#1e293b">{ts}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px">Threat Score</td>
          <td style="padding:8px 0;font-weight:600;color:#1e293b">
            {anomaly.composite_score:.3f}
          </td>
        </tr>
      </table>

      <div style="margin-top:20px;padding:16px;background:#f1f5f9;border-radius:8px">
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:600">RAW LOG</p>
        <code style="font-size:12px;color:#334155;word-break:break-all">
          {anomaly.parsed_log.raw}
        </code>
      </div>

      <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center">
        Sent by Log Sentinel · Live Monitoring
      </p>
    </div>
  </div>
</body>
</html>
"""


def send_email_alert(anomaly: Anomaly) -> None:
    if not GMAIL_PASSWORD or not GMAIL_USER or not ALERT_TO:
        print("[alerts] Email skipped — credentials not configured")
        return

    # Outer container supports both HTML body and PDF attachment
    msg = MIMEMultipart("mixed")
    msg["Subject"] = (
        f"⚠️ [{anomaly.severity}] {anomaly.threat_type} detected — Log Sentinel"
    )
    msg["From"] = GMAIL_USER
    msg["To"] = ALERT_TO

    # HTML body wrapped in an alternative sub-part
    html_part = MIMEMultipart("alternative")
    html_part.attach(MIMEText(_build_email_html(anomaly), "html"))
    msg.attach(html_part)

    # PDF attachment
    try:
        from pdf_report import generate_pdf_report
        pdf_bytes = generate_pdf_report(anomaly)
        ts_tag = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"threat_report_{ts_tag}.pdf"

        attachment = MIMEBase("application", "pdf")
        attachment.set_payload(pdf_bytes)
        encoders.encode_base64(attachment)
        attachment.add_header(
            "Content-Disposition",
            "attachment",
            filename=filename,
        )
        msg.attach(attachment)
        print(f"[alerts] PDF report attached: {filename}")
    except Exception as exc:
        print(f"[alerts] PDF generation failed (email still sent): {exc}")

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
        server.login(GMAIL_USER, GMAIL_PASSWORD)
        server.sendmail(GMAIL_USER, ALERT_TO, msg.as_string())

    print(f"[alerts] Email sent -> {ALERT_TO}")


_THREAT_DIAGNOSTIC = {
    "BRUTE_FORCE": (
        "Automated tooling is systematically trying username+password combos against SSH (port 22). "
        "Every 'Failed password' line = one attempt. "
        "High rate = dictionary or credential-stuffing campaign."
    ),
    "ACCOUNT_COMPROMISE": (
        "Brute-force succeeded — the attacker obtained working credentials. "
        "All actions by this account going forward are attacker-controlled. "
        "Audit authorized_keys, crontabs, and sudo rules immediately."
    ),
    "LATERAL_MOVEMENT": (
        "One account is authenticating to multiple internal hosts in rapid succession. "
        "Post-compromise spreading via SSH — the attacker is using stolen creds to pivot "
        "to other machines on your network."
    ),
    "PERSISTENCE": (
        "A cron job was planted in /tmp or /var/tmp (world-writable, survives reboots). "
        "An auto-executing backdoor script is now scheduled. "
        "Check: crontab -l for all users, /etc/cron.d/, /var/spool/cron/"
    ),
    "EXTERNAL_ACCESS": (
        "A public internet IP authenticated to your SSH service. "
        "If this IP is a VPN/Tor exit node or unknown datacenter, treat as unauthorized access. "
        "Review 'last', 'who', and .bash_history for this session."
    ),
    "PRIVILEGE_ESCALATION": (
        "Sudo was used to spawn a root shell (/bin/bash or /bin/sh as root). "
        "The attacker now has full system administrator access — they can disable logging, "
        "add backdoor accounts, install rootkits, and read /etc/shadow."
    ),
    "SYSTEM_TAMPERING": (
        "A network interface was placed in promiscuous mode. "
        "Packet capture software (Wireshark/tcpdump) is actively running. "
        "ALL unencrypted network traffic — passwords, tokens, API keys — is being recorded."
    ),
    "UNKNOWN": (
        "Isolation Forest ML model flagged this as a statistical outlier. "
        "No specific SIEM rule matched, but behaviour patterns are abnormal. "
        "Correlate with other events from the same IP or user."
    ),
}

_THREAT_ACTIONS = {
    "BRUTE_FORCE": [
        "ufw deny from {ip} to any",
        "fail2ban-client status sshd",
        "grep 'Accepted' /var/log/auth.log | grep {ip}",
    ],
    "ACCOUNT_COMPROMISE": [
        "passwd -l {user}   # lock the account immediately",
        "grep {user} /var/log/auth.log | tail -50",
        "cat /var/spool/cron/{user}  # check for planted cron",
    ],
    "LATERAL_MOVEMENT": [
        "who   # who is currently logged in",
        "last -20   # recent login history",
        "netstat -tnp | grep ssh",
    ],
    "PERSISTENCE": [
        "crontab -l -u {user}",
        "ls -la /tmp /var/tmp",
        "find /tmp /var/tmp -type f -newer /etc/passwd",
    ],
    "EXTERNAL_ACCESS": [
        "last -20   # check recent logins",
        "grep {ip} /var/log/auth.log | tail -30",
        "ufw deny from {ip}",
    ],
    "PRIVILEGE_ESCALATION": [
        "grep sudo /var/log/auth.log | tail -20",
        "who   # check active root sessions",
        "auditctl -l   # check if auditd is running",
    ],
    "SYSTEM_TAMPERING": [
        "ip link show   # check promiscuous flag",
        "ps aux | grep -E 'tcpdump|wireshark|tshark'",
        "lsof -i   # check open network connections",
    ],
    "UNKNOWN": [
        "grep {ip} /var/log/auth.log | tail -20",
        "last | grep {user}",
        "journalctl -u ssh --since '1 hour ago'",
    ],
}


def _is_vpn_ip(isp: str) -> str | None:
    """Return a VPN/proxy label if the ISP name suggests an anonymisation service."""
    if not isp:
        return None
    isp_lower = isp.lower()
    checks = [
        ("tor", "Tor Exit Node"),
        ("nordvpn", "NordVPN"),
        ("mullvad", "Mullvad VPN"),
        ("protonvpn", "ProtonVPN"),
        ("expressvpn", "ExpressVPN"),
        ("surfshark", "Surfshark VPN"),
        ("ipvanish", "IPVanish"),
        ("pia", "PIA VPN"),
        ("privateinternetaccess", "PIA VPN"),
        ("hetzner", "Hetzner (VPN Host)"),
        ("vultr", "Vultr (VPN Host)"),
        ("linode", "Linode (VPN Host)"),
        ("digitalocean", "DigitalOcean (VPN Host)"),
        ("ovh", "OVH (VPN Host)"),
        ("datacenter", "Datacenter / VPN Host"),
        ("anonymous", "Anonymous Proxy"),
        ("vpn", "VPN Service"),
    ]
    for keyword, label in checks:
        if keyword in isp_lower:
            return label
    return None


def _fmt_timestamp(ts) -> str:
    """Format a datetime or ISO string as: Apr 16, 2025 — 18:22:28"""
    try:
        from datetime import datetime
        if hasattr(ts, "strftime"):
            return ts.strftime("%b %d, %Y — %H:%M:%S")
        s = str(ts)[:19].replace("T", " ")
        dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%b %d, %Y — %H:%M:%S")
    except Exception:
        return str(ts)[:19]


def _confidence_label(score: float) -> str:
    if score <= -0.1:
        return "High Confidence"
    if score <= 0:
        return "Medium Confidence"
    return "Low Confidence"


def _send_telegram_to(chat_id: str, text: str) -> None:
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    req = urllib.request.Request(
        url,
        data=json.dumps({"chat_id": chat_id, "text": text}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=10)
    print(f"[alerts] Telegram sent -> chat {chat_id}")


def send_telegram_alert(anomaly: Anomaly, isp: str = "") -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[alerts] Telegram skipped — credentials not configured")
        return

    severity = anomaly.severity.value if hasattr(anomaly.severity, "value") else str(anomaly.severity)
    threat_type = anomaly.threat_type.value if hasattr(anomaly.threat_type, "value") else str(anomaly.threat_type)
    threat_label = threat_type.replace("_", " ").title()

    emoji = _SEVERITY_EMOJI.get(severity, "⚪")
    ip     = anomaly.parsed_log.ip or "unknown"
    user   = anomaly.parsed_log.user or "—"
    host   = getattr(anomaly.parsed_log, "host", None) or "—"
    action = anomaly.parsed_log.action or "—"
    action_label = action.replace("_", " ").title()
    ts_str = _fmt_timestamp(anomaly.parsed_log.timestamp)
    confidence = _confidence_label(anomaly.composite_score)

    # VPN detection
    vpn_label = _is_vpn_ip(isp)
    ip_display = f"{ip}  🔒 ({vpn_label})" if vpn_label else ip

    # Risk score display
    risk_score = f"{anomaly.composite_score:.3f} ({confidence})"

    # Raw log — first 2 lines, indented
    raw_lines = anomaly.parsed_log.raw.strip().splitlines()[:2]
    raw_display = "\n".join(f"  {ln}" for ln in raw_lines)

    text = (
        f"🚨 THREAT DETECTED — Log Sentinel\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"{emoji} Severity   : {severity}\n"
        f"⚡ Type       : {threat_label}\n"
        f"📅 Time       : {ts_str}\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🖥️  Host      : {host}\n"
        f"🌐 Source IP  : {ip_display}\n"
        f"👤 User       : {user}\n"
        f"❌ Action     : {action_label}\n"
        f"🎯 Risk Score : {risk_score}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"📋 Raw Log:\n{raw_display}\n"
    )

    _send_telegram_to(TELEGRAM_CHAT_ID, text)
    if TELEGRAM_GROUP_CHAT_ID:
        _send_telegram_to(TELEGRAM_GROUP_CHAT_ID, text)


def send_pdf_to_email(to_email: str, pdf_bytes: bytes, filename: str = "threat_report.pdf") -> None:
    """Send a PDF report to any given email address (used by the manual email-report feature)."""
    if not GMAIL_PASSWORD or not GMAIL_USER:
        raise RuntimeError("Email credentials not configured (ALERT_EMAIL_FROM / GMAIL_APP_PASSWORD)")

    msg = MIMEMultipart("mixed")
    msg["Subject"] = "Log Sentinel — Security Analysis Report"
    msg["From"] = GMAIL_USER
    msg["To"] = to_email

    html_body = """
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f8fafc;padding:32px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;
              box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden">
    <div style="background:linear-gradient(135deg,#818cf8,#6366f1);padding:20px 28px">
      <h1 style="color:#fff;margin:0;font-size:20px">Log Sentinel — Security Report</h1>
    </div>
    <div style="padding:28px">
      <p style="font-size:14px;color:#334155;margin:0 0 16px">
        Your security analysis report is attached as a PDF.
      </p>
      <p style="font-size:13px;color:#64748b;margin:0">
        Open the attached file to view the full threat breakdown, anomaly details,
        AI briefing, and remediation steps.
      </p>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center">
        Sent by Log Sentinel · Security Analysis Platform
      </p>
    </div>
  </div>
</body>
</html>
"""
    html_part = MIMEMultipart("alternative")
    html_part.attach(MIMEText(html_body, "html"))
    msg.attach(html_part)

    attachment = MIMEBase("application", "pdf")
    attachment.set_payload(pdf_bytes)
    encoders.encode_base64(attachment)
    attachment.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(attachment)

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
        server.login(GMAIL_USER, GMAIL_PASSWORD)
        server.sendmail(GMAIL_USER, to_email, msg.as_string())

    print(f"[alerts] Report emailed -> {to_email}")


def fire_alerts(anomaly: Anomaly) -> None:
    """Send email + Telegram for this anomaly. Called in a background thread."""
    try:
        send_email_alert(anomaly)
    except Exception as exc:
        print(f"[alerts] Email failed: {exc}")
    try:
        send_telegram_alert(anomaly)
    except Exception as exc:
        print(f"[alerts] Telegram failed: {exc}")
