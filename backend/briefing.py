"""
backend/briefing.py — Gemini 1.5 Flash integration for Log-Sentinel AI briefings.
"""

import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

_api_key = os.getenv("GEMINI_API_KEY", "")
if _api_key:
    genai.configure(api_key=_api_key)

_model = None

BRIEFING_PROMPT = """You are LOG-SENTINEL, an elite AI security analyst.
Write a concise security briefing (4-5 sentences) for this anomaly.
Be technical, specific, and end with one concrete remediation step.
Do NOT use bullet points. Write as flowing authoritative prose.

ANOMALY: {title}
SEVERITY: {severity} (score: {score})
SOURCE: {ip} [{country}]
AFFECTED USER: {user}
TIME WINDOW: {time_range}
EVENT COUNT: {count}
TAGS: {tags}
TECHNICAL DETAIL: {detail}

Write the briefing now:"""

FALLBACK_BRIEFINGS = {
    "brute_force": (
        "SENTINEL-AI analysis: A coordinated brute-force credential attack was detected originating from "
        "Tor exit node infrastructure, targeting privileged accounts including root, admin, and postgres. "
        "The attacker systematically cycled through {count} authentication attempts over a concentrated "
        "5-minute burst window, indicating automated tooling such as Hydra or Medusa. The source IP range "
        "185.220.101.x is a known Tor exit relay, making attribution extremely difficult. "
        "Immediate action required: block CIDR 185.220.101.0/24 at the firewall and enforce fail2ban with "
        "a 10-attempt lockout threshold."
    ),
    "impossible_travel": (
        "SENTINEL-AI analysis: An impossible travel anomaly was detected on user account j.kapoor — "
        "a successful login was recorded from San Francisco (US) followed 18 minutes later by a login from "
        "Lagos, Nigeria — a physical distance requiring supersonic travel at 14,200 km/h. "
        "This pattern is consistent with credential theft and concurrent session hijacking, possibly via "
        "phishing or a previously compromised endpoint. The Nigerian session immediately triggered a bulk "
        "data export, indicating a targeted data theft operation. "
        "Immediate action: terminate all active sessions for j.kapoor, reset credentials, and audit all "
        "exported data for PII or IP leakage."
    ),
    "privilege_escalation": (
        "SENTINEL-AI analysis: A rapid privilege escalation chain was detected within a 34-second window, "
        "progressing from the www-data web application user through backup and ultimately achieving root "
        "access via unsecured sudo configuration. This pattern is consistent with exploitation of a web "
        "application vulnerability followed by local privilege escalation — a two-stage attack vector. "
        "The speed of escalation suggests use of pre-compiled exploit code or a misconfigured sudoers file. "
        "Immediate action: audit /etc/sudoers for NOPASSWD entries, rotate root credentials, and inspect "
        "web server processes for signs of webshell implantation."
    ),
    "port_scan": (
        "SENTINEL-AI analysis: An aggressive TCP SYN port scan was detected from a Russian IP range "
        "45.142.212.x, probing 1847 ports over 163 seconds — a rate consistent with Masscan or Nmap "
        "aggressive timing templates. The sequential port progression indicates systematic service "
        "enumeration targeting the full TCP port space for attack surface mapping. This activity represents "
        "active reconnaissance preceding a targeted intrusion attempt. "
        "Immediate action: block the source CIDR at the perimeter, enable port-scan detection in your IDS, "
        "and audit exposed services for unnecessary attack surface."
    ),
    "data_exfiltration": (
        "SENTINEL-AI analysis: The db_readonly_svc account executed a full mysqldump at 03:47 and piped "
        "2.3GB of database content to a non-whitelisted DigitalOcean IP (178.62.55.19). "
        "This operation is anomalous on three dimensions: the read-only service account should not have "
        "dump permissions, the destination IP is not in any approved egress allowlist, and the 03:47 "
        "timestamp falls in the off-hours window flagged for sensitive operations. "
        "This is consistent with insider threat or compromised service account activity. "
        "Immediate action: revoke mysqldump privileges from db_readonly_svc, block outbound traffic to "
        "178.62.55.19, and initiate a data breach assessment."
    ),
}


def get_model():
    global _model
    if _model is None and _api_key:
        _model = genai.GenerativeModel("gemini-1.5-flash")
    return _model


async def generate_briefing(anomaly: dict) -> str:
    """Generate an AI security briefing for an anomaly. Falls back to hardcoded text if API unavailable."""
    atype = anomaly.get("type", "anomaly")
    title = anomaly.get("title", "Unknown Anomaly")
    severity = anomaly.get("severity", "high")
    score = anomaly.get("score", 0.0)
    ip = anomaly.get("source_ip", "unknown")
    country = anomaly.get("source_country", "unknown")
    user = anomaly.get("affected_user", "unknown")
    time_range = anomaly.get("time_range", "unknown")
    count = anomaly.get("event_count", 1)
    tags = ", ".join(anomaly.get("tags", []))
    detail = anomaly.get("detail", "")

    model = get_model()
    if model:
        prompt = BRIEFING_PROMPT.format(
            title=title,
            severity=severity,
            score=score,
            ip=ip,
            country=country,
            user=user,
            time_range=time_range,
            count=count,
            tags=tags,
            detail=detail[:500],
        )
        try:
            response = await model.generate_content_async(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"[briefing] Gemini API error, using fallback: {e}")

    # Fallback
    fallback = FALLBACK_BRIEFINGS.get(
        atype,
        f"SENTINEL-AI analysis: Anomaly detected with score {score:.2f} from {ip} ({country}). "
        f"The activity pattern is consistent with {atype.replace('_', ' ')}. "
        f"Immediate investigation is recommended. "
        f"Review all log entries from {ip} and correlate with downstream access patterns."
    )
    return fallback.format(count=count, ip=ip, country=country, user=user, time_range=time_range)
