"""
backend/alerts.py — Telegram + Email alert dispatcher (Phase 3 — stub).
"""

import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
ALERT_EMAIL_TO = os.getenv("ALERT_EMAIL_TO", "")


async def send_telegram_alert(anomaly: dict) -> bool:
    """Send a Telegram message for a CRITICAL anomaly. Returns True if sent."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[alerts] Telegram not configured — skipping")
        return False

    try:
        import telegram
        bot = telegram.Bot(token=TELEGRAM_BOT_TOKEN)
        msg = (
            f"🚨 *LOG-SENTINEL ALERT*\n\n"
            f"*{anomaly.get('title', 'Anomaly')}*\n"
            f"Severity: `{anomaly.get('severity', 'unknown').upper()}`\n"
            f"Score: `{anomaly.get('score', 0):.2f}`\n"
            f"Source IP: `{anomaly.get('source_ip', 'unknown')}` [{anomaly.get('source_country', '')}]\n"
            f"User: `{anomaly.get('affected_user', 'unknown')}`\n"
            f"Time: `{anomaly.get('time_range', 'unknown')}`\n\n"
            f"Tags: {', '.join(anomaly.get('tags', []))}"
        )
        await bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=msg, parse_mode="Markdown")
        return True
    except Exception as e:
        print(f"[alerts] Telegram send failed: {e}")
        return False


async def send_email_alert(anomaly: dict) -> bool:
    """Send an email alert via Resend for HIGH/CRITICAL anomalies. Returns True if sent."""
    if not RESEND_API_KEY or not ALERT_EMAIL_TO:
        print("[alerts] Email not configured — skipping")
        return False

    try:
        import resend
        resend.api_key = RESEND_API_KEY
        resp = resend.Emails.send({
            "from": "Log-Sentinel <alerts@log-sentinel.app>",
            "to": [ALERT_EMAIL_TO],
            "subject": f"[LOG-SENTINEL] {anomaly.get('severity', '').upper()} — {anomaly.get('title', 'Anomaly')}",
            "html": f"""
            <h2 style="color:#ff3355;">⚠️ Log-Sentinel Alert</h2>
            <p><b>Anomaly:</b> {anomaly.get('title')}</p>
            <p><b>Severity:</b> {anomaly.get('severity', '').upper()}</p>
            <p><b>Score:</b> {anomaly.get('score', 0):.4f}</p>
            <p><b>Source IP:</b> {anomaly.get('source_ip')} [{anomaly.get('source_country')}]</p>
            <p><b>Affected User:</b> {anomaly.get('affected_user')}</p>
            <p><b>Time Range:</b> {anomaly.get('time_range')}</p>
            <p><b>Event Count:</b> {anomaly.get('event_count')}</p>
            <p><b>Tags:</b> {', '.join(anomaly.get('tags', []))}</p>
            <hr>
            <p style="font-size:12px;color:#888;">Log-Sentinel — AI-Powered Security Monitoring</p>
            """,
        })
        return True
    except Exception as e:
        print(f"[alerts] Email send failed: {e}")
        return False


async def dispatch_alerts(anomalies: list[dict]) -> None:
    """Fire alerts for critical and high severity anomalies."""
    for anomaly in anomalies:
        sev = anomaly.get("severity", "low")
        if sev == "critical":
            await send_telegram_alert(anomaly)
            await send_email_alert(anomaly)
        elif sev == "high":
            await send_email_alert(anomaly)
