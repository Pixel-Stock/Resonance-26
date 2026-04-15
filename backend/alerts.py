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
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from schemas import Anomaly

GMAIL_USER = os.getenv("ALERT_EMAIL_FROM", "")
GMAIL_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "")
ALERT_TO = os.getenv("ALERT_EMAIL_TO", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

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

    msg = MIMEMultipart("alternative")
    msg["Subject"] = (
        f"⚠️ [{anomaly.severity}] {anomaly.threat_type} detected — Log Sentinel"
    )
    msg["From"] = GMAIL_USER
    msg["To"] = ALERT_TO

    msg.attach(MIMEText(_build_email_html(anomaly), "html"))

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
        server.login(GMAIL_USER, GMAIL_PASSWORD)
        server.sendmail(GMAIL_USER, ALERT_TO, msg.as_string())

    print(f"[alerts] Email sent -> {ALERT_TO}")


def send_telegram_alert(anomaly: Anomaly) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[alerts] Telegram skipped — credentials not configured")
        return

    emoji = _SEVERITY_EMOJI.get(anomaly.severity, "⚪")
    ip = anomaly.parsed_log.ip or "unknown"
    action = anomaly.parsed_log.action or "unknown"
    user = anomaly.parsed_log.user or "-"

    text = (
        f"{emoji} *THREAT DETECTED* — Log Sentinel\n\n"
        f"*Severity:* `{anomaly.severity}`\n"
        f"*Type:* `{anomaly.threat_type}`\n"
        f"*Source IP:* `{ip}`\n"
        f"*User:* `{user}`\n"
        f"*Action:* `{action}`\n"
        f"*Score:* `{anomaly.composite_score:.3f}`\n\n"
        f"```\n{anomaly.parsed_log.raw[:200]}\n```"
    )

    payload = json.dumps({
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "Markdown",
    }).encode()

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=10)
    print(f"[alerts] Telegram sent -> chat {TELEGRAM_CHAT_ID}")


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
