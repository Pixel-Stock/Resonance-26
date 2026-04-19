"""
PDF report generator for live monitoring threat alerts.
Produces a professional, colour-coded threat report using reportlab.
"""

from __future__ import annotations

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from schemas import Anomaly

_SEVERITY_COLORS = {
    "CRITICAL": colors.HexColor("#dc2626"),
    "HIGH":     colors.HexColor("#ea580c"),
    "MEDIUM":   colors.HexColor("#d97706"),
    "LOW":      colors.HexColor("#65a30d"),
}

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


def _fmt_timestamp(ts) -> str:
    try:
        if hasattr(ts, "strftime"):
            return ts.strftime("%b %d, %Y — %H:%M:%S")
        s = str(ts)[:19].replace("T", " ")
        dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%b %d, %Y — %H:%M:%S")
    except Exception:
        return str(ts)[:19]


def generate_pdf_report(anomaly: Anomaly) -> bytes:
    """Generate a PDF threat report for a live monitoring anomaly. Returns PDF bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()

    severity = anomaly.severity.value if hasattr(anomaly.severity, "value") else str(anomaly.severity)
    threat_type = anomaly.threat_type.value if hasattr(anomaly.threat_type, "value") else str(anomaly.threat_type)
    threat_label = threat_type.replace("_", " ").title()
    sev_color = _SEVERITY_COLORS.get(severity, colors.HexColor("#6b7280"))

    ip     = anomaly.parsed_log.ip or "unknown"
    user   = anomaly.parsed_log.user or "—"
    host   = getattr(anomaly.parsed_log, "host", None) or "—"
    action = anomaly.parsed_log.action or "—"
    ts_str = _fmt_timestamp(anomaly.parsed_log.timestamp)
    raw    = anomaly.parsed_log.raw.strip()

    # ── Shared styles ─────────────────────────────────────────────────────────
    section_style = ParagraphStyle(
        "section",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#64748b"),
        fontName="Helvetica-Bold",
        spaceBefore=14,
        spaceAfter=4,
        leading=12,
    )
    body_style = ParagraphStyle(
        "body",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#334155"),
        leading=14,
        leftIndent=10,
    )
    code_style = ParagraphStyle(
        "code",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#334155"),
        fontName="Courier",
        backColor=colors.HexColor("#f1f5f9"),
        leftIndent=10,
        rightIndent=10,
        leading=12,
        borderPad=6,
    )

    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    story.append(Paragraph(
        "Log Sentinel",
        ParagraphStyle(
            "title",
            parent=styles["Normal"],
            fontSize=22,
            textColor=colors.HexColor("#1e293b"),
            fontName="Helvetica-Bold",
            spaceAfter=4,
        ),
    ))
    story.append(Paragraph(
        f"Live Monitoring Threat Report — Generated "
        f"{datetime.utcnow().strftime('%b %d, %Y at %H:%M:%S UTC')}",
        ParagraphStyle(
            "subtitle",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=12,
        ),
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0")))
    story.append(Spacer(1, 0.15 * inch))

    # ── Severity badge (coloured table cell) ──────────────────────────────────
    badge_table = Table(
        [[f"  {severity}  —  {threat_label}  "]],
        colWidths=[7 * inch],
    )
    badge_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), sev_color),
        ("TEXTCOLOR",    (0, 0), (-1, -1), colors.white),
        ("FONTNAME",     (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, -1), 14),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
        ("LEFTPADDING",  (0, 0), (-1, -1), 12),
        ("ROUNDEDCORNERS", [4]),
    ]))
    story.append(badge_table)
    story.append(Spacer(1, 0.15 * inch))

    # ── Threat details table ───────────────────────────────────────────────────
    story.append(Paragraph("THREAT DETAILS", section_style))

    table_data = [
        ["Severity",     severity],
        ["Threat Type",  threat_label],
        ["Source IP",    ip],
        ["User",         user],
        ["Host",         host],
        ["Action",       action.replace("_", " ").title()],
        ["Timestamp",    ts_str],
        ["Risk Score",   f"{anomaly.composite_score:.3f}"],
    ]
    if anomaly.attack_chain:
        table_data.append(["Attack Chain", " → ".join(anomaly.attack_chain)])

    detail_table = Table(table_data, colWidths=[1.8 * inch, 5.2 * inch])
    detail_table.setStyle(TableStyle([
        ("FONTNAME",      (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 0), (-1, -1), 9),
        ("FONTNAME",      (0, 0), (0, -1),  "Helvetica-Bold"),
        ("TEXTCOLOR",     (0, 0), (0, -1),  colors.HexColor("#64748b")),
        ("TEXTCOLOR",     (1, 0), (1, -1),  colors.HexColor("#1e293b")),
        ("ROWBACKGROUNDS",(0, 0), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ("BOX",           (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
    ]))
    story.append(detail_table)

    # ── Raw log ───────────────────────────────────────────────────────────────
    story.append(Paragraph("RAW LOG", section_style))
    raw_display = raw[:600] + ("…" if len(raw) > 600 else "")
    # Escape XML special chars for Paragraph
    raw_escaped = (
        raw_display
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )
    story.append(Paragraph(raw_escaped, code_style))

    # ── Diagnostic ────────────────────────────────────────────────────────────
    diag = _THREAT_DIAGNOSTIC.get(threat_type, "")
    if diag:
        story.append(Paragraph("DIAGNOSTIC", section_style))
        story.append(Paragraph(diag, body_style))

    # ── Recommended actions ───────────────────────────────────────────────────
    actions = _THREAT_ACTIONS.get(threat_type, [])
    if actions:
        story.append(Paragraph("RECOMMENDED ACTIONS", section_style))
        for cmd in actions:
            filled = cmd.replace("{ip}", ip).replace("{user}", user)
            filled_escaped = (
                filled
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            )
            story.append(Paragraph(
                f"&bull;&nbsp; <font name='Courier'>{filled_escaped}</font>",
                body_style,
            ))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.25 * inch))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0")))
    story.append(Paragraph(
        "Generated by Log Sentinel · Live Monitoring · Confidential",
        ParagraphStyle(
            "footer",
            parent=styles["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#94a3b8"),
            alignment=TA_CENTER,
            spaceBefore=6,
        ),
    ))

    doc.build(story)
    return buffer.getvalue()
