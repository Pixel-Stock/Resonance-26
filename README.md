# Resonance-26

# Log-Sentinel 

> AI-powered security log anomaly detection • Built for hackathon in &lt;24h

[![Deploy Backend](https://railway.app/button.svg)](https://railway.app)
[![Deploy Frontend](https://vercel.com/button)](https://vercel.com)

## What It Does

Log-Sentinel ingests raw system log files, runs **unsupervised Isolation Forest ML** to detect anomalies, ranks the top 5 threats by severity, and generates expert security briefings via **Gemini 1.5 Flash** — all in under 3 seconds.

### Detected Anomaly Types
| Type | Detection Method |
|------|-----------------|
|  Brute Force SSH | failure_ratio > 0.9 + req burst > 50/min |
|  Impossible Travel | geo_velocity > 800 km/h same-user logins |
|  Privilege Escalation | www-data → root sudo chain in < 60s |
|  Port Scan | port_diversity > 100 + sequential pattern |
|  Data Exfiltration | off-hours DB dump + non-whitelisted egress |

## Tech Stack

- **Frontend**: Next.js 14 + Tailwind + Recharts → Vercel
- **Backend**: FastAPI + scikit-learn + pandas → Railway
- **AI**: Gemini 1.5 Flash (free API)
- **ML**: Isolation Forest (unsupervised, no labeled data needed)

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # add your GEMINI_API_KEY
python demo_data.py   # generate demo log
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### Demo
1. Click **"LOAD DEMO SCENARIO"**
2. Watch the scan animation
3. Click each anomaly in the left panel
4. Click **"AI BRIEFING"** tab → **Generate AI Briefing**
5. Try the filter buttons (CRITICAL / BRUTE FORCE / GEO ANOMALY)

## Deployment

**Backend → Railway:**
```bash
# Set env var: GEMINI_API_KEY = your_key
railway up
```

**Frontend → Vercel:**
```bash
# Set env var: NEXT_PUBLIC_BACKEND_URL = https://your-app.up.railway.app
vercel --prod
```

## Repository Structure

```
log-sentinel/
├── backend/          # FastAPI + ML pipeline
│   ├── main.py       # API routes + orchestration
│   ├── parser.py     # Multi-format log parser
│   ├── features.py   # 14 behavioral ML features
│   ├── detector.py   # Isolation Forest wrapper
│   ├── ranker.py     # Anomaly type + severity classification
│   ├── briefing.py   # Gemini 1.5 Flash integration
│   └── demo_data.py  # ~8000 line demo log generator
├── frontend/         # Next.js 14 dashboard
│   ├── app/          # App router + global styles
│   ├── components/   # All UI components
│   └── lib/          # API client + TypeScript types
└── demo/
    └── sample.log    # Pre-generated demo log (8000+ lines)
```

## Key Talking Points

- **"Isolation Forest detects anomalies without labeled training data — fully unsupervised"**
- **"Average enterprise SIEM costs $10K/month. This runs on Vercel and Railway free tier."**
- **"Detection happens in under 3 seconds on 8,000+ log lines"**
- **"The AI briefing isn't just a label — it explains attack vector, impact, and remediation"**

---

Built with ❤ for cybersecurity hackathon • Team Log-Sentinel
