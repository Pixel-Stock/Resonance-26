# CLAUDE.md — Log-Sentinel: AI-Powered Log Anomaly Detection

## What This Project Is

Log-Sentinel is a hackathon project (< 24 hours) that solves real-time security anomaly detection in system logs. It parses raw `.log` files, runs Isolation Forest ML on them, ranks the top threats by severity, generates AI-written security briefings per anomaly via Gemini 1.5 Flash, and optionally fires Telegram + Email alerts. Judges interact with a live dashboard.

**Hackathon problem statement:** Detecting suspicious activities from large-scale system logs. Expected: parse logs, run anomaly detection, identify suspicious events, output top 5 anomalies ranked by severity with an AI-generated security briefing.

**USP:** Free. Fully automated. Telegram alerts fire in real time during the demo. Judges watch their phone light up. No enterprise SIEM needed.

---

## Team Context

3 people. < 24 hours. Deployed on Vercel (frontend) + Railway free tier (Python backend). No budget — use free APIs only.

---

## Tech Stack

### Frontend
- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** for styling — dark terminal/cybersecurity aesthetic
- **Recharts** for the 24h activity timeline chart
- **Deployed to Vercel** (free tier)

### Backend (Python microservice)
- **FastAPI** — single service, two endpoints
- **scikit-learn** — Isolation Forest for anomaly detection
- **pandas** — log parsing and feature engineering
- **python-telegram-bot** — Telegram alert integration (last-priority feature)
- **resend** Python SDK — email alerts (last-priority feature)
- **google-generativeai** — Gemini 1.5 Flash for AI briefings
- **Deployed to Railway** free tier

### AI
- **Gemini 1.5 Flash** (free, fast, generous rate limit)
- Used for: per-anomaly security briefings (4-5 sentences, technical, actionable)

### Alerts (implement last, after core works)
- **Telegram Bot** via `python-telegram-bot` — fires on CRITICAL anomalies
- **Email** via Resend.com — fires on HIGH + CRITICAL anomalies

---

## Repository Structure

```
log-sentinel/
├── frontend/                     # Next.js app
│   ├── app/
│   │   ├── page.tsx              # Main dashboard page
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── Dashboard.tsx         # Main layout shell
│   │   ├── UploadZone.tsx        # Drag-drop log file input
│   │   ├── AnomalyList.tsx       # Left sidebar — ranked anomaly queue
│   │   ├── AnomalyCard.tsx       # Individual anomaly item
│   │   ├── AnomalyDetail.tsx     # Right panel — full anomaly detail
│   │   ├── LogViewer.tsx         # Raw log evidence with highlighting
│   │   ├── MetricsBar.tsx        # Header stats (critical count, lines, IPs)
│   │   ├── TimelineChart.tsx     # 24h activity chart via Recharts
│   │   ├── IPTable.tsx           # IP risk analysis table
│   │   ├── AIBriefing.tsx        # AI briefing panel with typewriter effect
│   │   └── ScanOverlay.tsx       # Full-screen scan animation
│   ├── lib/
│   │   ├── api.ts                # All fetch calls to backend
│   │   └── types.ts              # Shared TypeScript types
│   ├── public/
│   │   └── demo-logs/
│   │       └── demo.log          # Synthetic demo log file (generated)
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                      # FastAPI Python service
│   ├── main.py                   # FastAPI app, routes
│   ├── parser.py                 # Log parser — regex + heuristics
│   ├── features.py               # Feature engineering from parsed logs
│   ├── detector.py               # Isolation Forest wrapper
│   ├── ranker.py                 # Score → severity classification + ranking
│   ├── briefing.py               # Gemini 1.5 Flash integration
│   ├── alerts.py                 # Telegram + Email alert dispatcher
│   ├── demo_data.py              # Synthetic demo log generator
│   ├── requirements.txt
│   └── railway.toml              # Railway deployment config
│
├── demo/
│   └── sample.log                # Pre-generated realistic demo log file
│
└── README.md
```

---

## API Contract

### POST /analyze
Accepts a log file upload (multipart/form-data) or raw log text.

**Request:**
```
Content-Type: multipart/form-data
Field: file (binary .log/.txt file)
Field: raw_text (string — alternative to file upload)
```

**Response:**
```json
{
  "summary": {
    "total_lines": 14832,
    "unique_ips": 47,
    "time_range": "2025-04-10 00:00 — 12:00",
    "critical_count": 3,
    "high_count": 2,
    "anomalies_found": 5
  },
  "anomalies": [
    {
      "rank": 1,
      "id": "A001",
      "title": "Mass Failed Logins — Foreign IP Range",
      "severity": "critical",
      "score": 0.98,
      "type": "brute_force",
      "tags": ["brute-force", "geo-anomaly", "credential-stuffing"],
      "source_ip": "185.220.101.x",
      "source_country": "NL (Tor)",
      "affected_user": "root, admin, postgres",
      "time_range": "02:14:33 — 02:19:07",
      "event_count": 847,
      "detail": "...",
      "raw_logs": [
        {
          "timestamp": "02:14:33",
          "ip": "185.220.101.47",
          "message": "Failed password for root from 185.220.101.47 port 44812 ssh2",
          "flagged": true
        }
      ],
      "metadata": {}
    }
  ],
  "hourly_activity": [
    { "hour": "00:00", "normal": 24, "anomalous": 0, "warning": 0 }
  ]
}
```

### POST /briefing
Generates AI briefing for a single anomaly.

**Request:**
```json
{
  "anomaly_id": "A001",
  "anomaly_data": { ... }
}
```

**Response:**
```json
{
  "briefing": "SENTINEL-AI analysis: ..."
}
```

### GET /health
Returns `{ "status": "ok" }` — used by frontend to check if backend is alive.

### GET /demo-log
Returns the synthetic demo `.log` file as a download. Used by the "Load Demo" button on frontend.

---

## Core ML Pipeline (backend/detector.py)

### Feature Engineering (per log line/IP/window)
Extract these features from the parsed log data:

```python
features = {
    # Volume features
    "req_count_1min": int,        # requests per source IP in 1-min window
    "req_count_5min": int,        # requests per source IP in 5-min window
    "failure_ratio": float,       # failed/(failed+success) per IP
    "unique_users_targeted": int, # distinct usernames attempted

    # Temporal features
    "hour_of_day": int,           # 0-23, off-hours = 0-6 is suspicious
    "inter_req_delta_ms": float,  # avg milliseconds between requests (bots = very uniform)
    "request_burst": int,         # requests in 30-second window

    # Geographic/network features
    "is_known_tor_exit": bool,    # check against hardcoded Tor exit CIDR list
    "is_internal_ip": bool,       # RFC1918 check
    "geo_velocity_kmh": float,    # speed implied by same-user logins from different geos

    # Pattern features
    "port_diversity": int,        # distinct ports accessed (high = port scan)
    "privilege_account_targeted": bool,  # root/admin/postgres in username
    "sequential_port_pattern": bool,     # monotonically increasing ports = scan
    "off_hours_sensitive_op": bool,      # db dump / export outside 08:00-20:00
}
```

### Isolation Forest Config
```python
from sklearn.ensemble import IsolationForest

model = IsolationForest(
    n_estimators=100,
    contamination=0.05,   # expect ~5% anomalous events
    random_state=42,
    max_samples='auto'
)
```

Score normalization: sklearn returns negative scores (more negative = more anomalous). Normalize to 0-1 where 1 = most anomalous:
```python
scores = model.score_samples(X)
normalized = 1 - (scores - scores.min()) / (scores.max() - scores.min())
```

### Severity Classification
```python
def classify_severity(score: float) -> str:
    if score >= 0.90: return "critical"
    if score >= 0.75: return "high"
    if score >= 0.60: return "medium"
    return "low"
```

### Anomaly Type Detection (rule-based on top of ML score)
After isolation forest scoring, apply rule-based classifiers to label the *type* of anomaly:
- `brute_force`: failure_ratio > 0.9 AND req_count_1min > 50
- `impossible_travel`: geo_velocity_kmh > 800
- `privilege_escalation`: sudo chain detected in sequential log lines, distinct uid changes
- `port_scan`: port_diversity > 100 in 3-min window AND sequential_port_pattern = True
- `data_exfiltration`: large outbound transfer + off_hours_sensitive_op + non-whitelisted dest

---

## Log Parser (backend/parser.py)

Support these formats via regex. Try each pattern, fall back to generic:

```python
PATTERNS = {
    "auth_log": r'(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>\S+)\s+(?P<host>\S+)\s+(?P<service>\S+):\s+(?P<message>.*)',
    "nginx_access": r'(?P<ip>\S+)\s+-\s+-\s+\[(?P<time>[^\]]+)\]\s+"(?P<method>\S+)\s+(?P<path>\S+)\s+\S+"\s+(?P<status>\d+)\s+(?P<size>\d+)',
    "apache_access": r'(?P<ip>\S+)\s+\S+\s+\S+\s+\[(?P<time>[^\]]+)\]\s+"(?P<request>[^"]+)"\s+(?P<status>\d+)',
    "syslog": r'(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>\d{2}:\d{2}:\d{2})\s+(?P<host>\S+)\s+(?P<process>\S+)(?:\[(?P<pid>\d+)\])?:\s+(?P<message>.*)',
    "generic": r'(?P<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\s+(?P<level>\w+)\s+(?P<message>.*)',
}
```

Always extract: `timestamp`, `source_ip`, `message`, `raw_line`. Mark `None` for unavailable fields.

---

## Gemini Integration (backend/briefing.py)

```python
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

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
```

---

## Demo Data Generator (backend/demo_data.py)

Generate a realistic synthetic log file (~3000 lines) that contains:
1. Normal SSH auth success/fail traffic (baseline)
2. Embedded brute force burst from 185.220.101.x (Tor range) at 02:14
3. Impossible travel: same user login from US then NG 18 min later
4. Privilege escalation chain: www-data → backup → root via sudo
5. Port scan from 45.142.212.x (RU IP range)
6. Off-hours db dump from internal service account to non-whitelisted external IP

Output: `demo/sample.log` (auth.log format). This file ships with the repo so judges can immediately demo without uploading anything.

---

## Frontend Design System

Dark terminal aesthetic. Not generic. Use these CSS variables in Tailwind config:

```
--bg: #020d0a          (near-black green-tinted background)
--bg2: #041510         (panel background)
--bg3: #071e15         (card background)
--green: #00ff88       (primary accent, borders, highlights)
--red: #ff3355         (critical severity)
--amber: #ffaa00       (high severity)
--cyan: #00d4ff        (IP addresses, data values)
--text: #c8ffe0        (primary text)
--text-dim: #5a9970    (secondary text)
```

Font stack: `'Share Tech Mono', 'Orbitron', monospace` — load from Google Fonts.
All component labels in uppercase with letter-spacing. Severity badges are colored chips. No rounded corners > 4px. Everything feels like a terminal/SIEM.

---

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Backend (.env)
```
GEMINI_API_KEY=your_gemini_api_key
TELEGRAM_BOT_TOKEN=your_bot_token          # optional, implement last
TELEGRAM_CHAT_ID=your_chat_id              # optional
RESEND_API_KEY=your_resend_api_key         # optional
ALERT_EMAIL_TO=your@email.com              # optional
```

---

## Build Priority Order (24h hackathon)

### Phase 1 — Core (first 6 hours, MUST WORK)
1. FastAPI `/analyze` endpoint returning real JSON from Isolation Forest
2. Demo log file generated and committed to repo
3. Next.js dashboard rendering anomaly list from backend
4. Anomaly detail panel with raw log viewer

### Phase 2 — Polish (hours 6-14)
5. AI briefing endpoint (Gemini) + typewriter effect on frontend
6. Timeline chart (Recharts) + IP risk table
7. File upload + drag-drop working end-to-end
8. Scan animation overlay during processing
9. Filter buttons (severity, type)
10. Deploy frontend to Vercel, backend to Railway

### Phase 3 — Demo Extras (hours 14-20)
11. Telegram bot alert on CRITICAL anomaly detection
12. Email alert via Resend
13. Responsive polish, mobile-friendly
14. README with demo GIF/screenshots

### Phase 4 — Hackathon Prep (final 4 hours)
15. End-to-end demo rehearsal
16. Prepare talking points for each feature
17. Test Telegram alert live during presentation
18. Fallback: if backend is down, use hardcoded JSON mock in frontend

---

## Demo Script (for judges)

1. Open dashboard → show empty state
2. Click "Load Demo Scenario" → watch scan animation with progress bar and log messages
3. Anomaly #1 auto-selects (Brute Force) — walk through: score 0.98, raw logs highlighted in red, IP risk table, geo map
4. Click "Generate AI Briefing" → watch Gemini stream a real security brief
5. Click Anomaly #2 (Impossible Travel) — explain the 14,200km in 18 min detection
6. Show filter buttons — filter to CRITICAL only
7. Drag-drop a real log file if available
8. Fire Telegram alert manually — watch phone notification arrive (showstopper)

**Key talking points:**
- "Isolation Forest detects anomalies without labeled training data — fully unsupervised"
- "Average enterprise SIEM costs $10K/month. This runs on Vercel and Railway free tier."
- "Detection happens in under 3 seconds on 15,000 log lines"
- "The AI briefing isn't just a label — it explains attack vector, impact, and remediation"

---

## Known Constraints / Shortcuts Allowed

- Geo-IP lookup can be mocked with a hardcoded dict of known malicious CIDR ranges (Tor exits, known scanner ranges) — no need for a real MaxMind DB
- Impossible travel detection can be purely rule-based (two logins from same user, different country, < 60 min apart) — ML score alone may not catch it cleanly
- For the hackathon, Telegram bot can be set up with a single hardcoded chat ID (judge's group or team's own group)
- If Railway cold-starts during demo, have a hardcoded JSON fallback in the frontend that renders the full anomaly set without hitting the backend

---

## What NOT to Build

- User auth / login system (waste of time)
- Database persistence (in-memory is fine for hackathon)
- Multiple log format auto-detection UI (just handle it silently in the backend)
- Fancy onboarding (skip straight to the demo)
- Mobile app (responsive web is enough)
