# Log-Sentinel: AI-Powered Cybersecurity Anomaly Detection

## Goal Description

The objective is to build **Log-Sentinel**, an advanced cybersecurity log analysis tool that uses unsupervised machine learning (Isolation Forest) to detect anomalies in system logs (like brute-force attacks, impossible travel, and privilege escalation), ranks them by severity, and generates expert security briefings using the **Gemini 2.0 Flash** model (free tier via Google AI Studio). 

The application will feature a FastAPI backend for processing and ML, and a visually stunning Next.js (latest) frontend for the dashboard.

> All services and libraries used are **free / open-source**. Gemini 2.0 Flash is used via the Google AI Studio free tier (no billing required).

---

## Enhancements Over Original Plan

### 1. Robust Machine Learning Pipeline
- **Feature Scaling:** Normalize features with `StandardScaler` before feeding to Isolation Forest. Prevents large-range features from dominating scores.
- **Rule-Based Threat Classifier:** A dedicated `classifier.py` module runs *before* the ranker. It applies regex/heuristic rules to label each anomalous event (e.g. `BRUTE_FORCE`, `PRIVILEGE_ESCALATION`, `PORT_SCAN`, `IMPOSSIBLE_TRAVEL`). This resolves the chicken-and-egg problem of needing a threat type before applying threat weights.
- **Weighted Severity Ranking:** Composite score = `isolation_score × threat_type_weight`. Weights are defined in a config dict (e.g. `PRIVILEGE_ESCALATION: 1.8`, `BRUTE_FORCE: 1.5`, `PORT_SCAN: 1.0`).
- **Configurable contamination & top-N:** Both are query params on the API, not hardcoded values.

### 2. Streamlined API Design (Single Round-Trip)
Instead of 3 separate endpoints (`/upload`, `/analyze`, `/briefing`) requiring 3 chained calls, the flow is:

```
POST /api/analyze   (multipart: log file)
  → parse → feature engineer → classify → IF detect → rank
  → stream SSE: { anomalies: [...] }  then  { briefing: "..." chunk by chunk }
```

A single endpoint does everything and **streams** the AI briefing via Server-Sent Events (SSE). The frontend renders anomalies immediately while the briefing text streams in.

### 3. Smart AI Integration (Gemini 2.0 Flash — Free Tier)
- Use `google-generativeai` Python SDK.
- Set `response_mime_type: "application/json"` and provide a `response_schema` — this is Gemini's **native JSON mode**, far more reliable than prompt-based JSON forcing.
- Schema enforces: `{ executive_summary, technical_details, remediation_steps[] }`.
- Use `stream=True` on the Gemini call and forward chunks over SSE to the frontend.

### 4. Liquid Glass UI Theme
- **Shadcn UI** (`npx shadcn@latest init`) as the component foundation.
- **Framer Motion** for spring-based micro-animations (glass panels fading in, cards sliding up, scan shimmer).
- **TanStack Query** for server state — handles loading, error, and streaming states cleanly.
- **Recharts** timeline: log events over time with severity-colored anomaly markers overlaid.
- Configurable top-N results via a UI slider (default 10, not hardcoded 5).

**Theme: Liquid Glass (see screenshot reference)**

The UI departs from a harsh dark SOC aesthetic and instead uses the liquid glass design language:

**Background & Depth:**
- Warm off-white/sand base gradient (`#f0e8df → #e8ddd4`) — not dark
- 2–3 large, soft, blurred gradient blobs floating in the background (purple, teal, coral) using `position: fixed` divs with `blur(80px)` and low opacity — these give the iridescent glow behind glass panels

**Glass Panel Recipe (applied to every card/panel):**
```
background: rgba(255, 255, 255, 0.18)
backdrop-filter: blur(24px) saturate(180%)
border: 1px solid rgba(255, 255, 255, 0.45)
box-shadow:
  0 8px 32px rgba(0, 0, 0, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.6)   ← top-edge light catch
border-radius: 20px
```

**Color Palette:**
| Role | Value | Usage |
|---|---|---|
| Background base | `#f0e8df` | Page background |
| Glass fill | `rgba(255,255,255,0.18)` | All cards/panels |
| Purple blob | `#a78bfa` @ 35% opacity | Background accent, primary buttons |
| Teal blob | `#5eead4` @ 35% opacity | Secondary buttons, success states |
| Coral blob | `#fb7185` @ 35% opacity | Critical anomaly accents |
| Amber | `#fbbf24` @ 50% opacity | Medium severity badges |
| Text primary | `#1c1917` | Headings on glass |
| Text secondary | `#78716c` | Subtext |

**Buttons — Pill-Shaped Gradients:**
- Primary (Analyze): purple-to-violet gradient, white text, pill shape (`border-radius: 999px`), subtle inner glow
- Secondary (Reset/Export): teal gradient, same pill shape
- Hover state: `scale(1.03)` via Framer Motion spring + slight brightness lift

**Severity Mapping to Glass Colors:**
| Severity | Glass Tint | Border Accent |
|---|---|---|
| CRITICAL | `rgba(251, 113, 133, 0.25)` | coral |
| HIGH | `rgba(251, 146, 60, 0.22)` | amber-orange |
| MEDIUM | `rgba(251, 191, 36, 0.20)` | amber |
| LOW | `rgba(94, 234, 212, 0.20)` | teal |

**Component-Specific Styling:**

- **UploadZone:** Large frosted glass panel, dashed border with `rgba(255,255,255,0.5)`, centered upload icon. On hover, the background blob behind it subtly shifts via Framer Motion.
- **ScanAnimation:** Shimmer sweep effect — a `linear-gradient` highlight that slides across the glass panel surface using a CSS keyframe animation, simulating light catching glass.
- **AnomalyList cards:** Each card is a glass panel tinted by severity color. Entry animation: slide up + fade in with staggered delay per card (Framer Motion `staggerChildren`).
- **AIBriefingCard:** Purple-tinted glass panel with a gradient top-border. Streaming text renders with a blinking cursor until the SSE stream closes.
- **MetricsChart:** Recharts area chart inside a glass panel. Chart background transparent, grid lines `rgba(0,0,0,0.06)`, area fill uses a `linearGradient` from teal to transparent.
- **Toggles/Badges:** Pill-shaped, glass-tinted, matching severity colors.

**Tailwind Setup for Glass:**
Add custom utilities to `tailwind.config.ts`:
```
glass: 'backdrop-blur-2xl bg-white/[0.18] border border-white/[0.45] shadow-glass'
glass-critical: 'backdrop-blur-2xl bg-rose-400/[0.20] border border-rose-300/40'
glass-high: 'backdrop-blur-2xl bg-orange-400/[0.18] border border-orange-300/40'
glass-medium: 'backdrop-blur-2xl bg-amber-400/[0.18] border border-amber-300/40'
glass-low: 'backdrop-blur-2xl bg-teal-400/[0.18] border border-teal-300/40'
```
Custom `shadow-glass` value in theme: `0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)`

**No extra libraries needed** — all achieved with Tailwind custom utilities + Framer Motion + CSS variables.

### 5. Flexible Log Parsing & Realistic Demo Data
- `parser.py` ships with regex patterns for `syslog`, `auth.log`, Apache/Nginx access logs, and a generic fallback.
- `demo_data.py` generates valid IPs, realistic timestamp distributions, seeded anomaly events (brute-force burst, privilege escalation spike, impossible travel).

---

## Revised System Architecture

### Backend (`/backend`)

```
main.py          — FastAPI app, CORS middleware, /api/analyze SSE endpoint
parser.py        — Regex-based log parser (syslog, auth.log, Apache, fallback)
features.py      — Behavioral feature engineering (failed logins/min, unique ports/IP, etc.)
classifier.py    — Rule-based threat labeler (runs AFTER IF detection)
detector.py      — StandardScaler + Isolation Forest (contamination configurable)
ranker.py        — Composite score = IF score × threat weight; returns sorted list
briefing.py      — Gemini 2.0 Flash call with native JSON schema + streaming
demo_data.py     — Realistic synthetic log generator
schemas.py       — Pydantic models for request/response validation
config.py        — Threat type weights, contamination default, top-N default
```

**Key backend decisions:**
- `CORSMiddleware` configured from the start (`allow_origins=["http://localhost:3000"]`).
- File upload validated: max 10MB, must be `.log` / `.txt` / plain text MIME type.
- Timestamps normalized to UTC in `parser.py`.
- Isolation Forest is retrained per request (intentional for demo; stateless).

### Frontend (`/frontend`)

```
/app/page.tsx                  — Main dashboard, orchestrates upload + SSE stream
/app/layout.tsx                — Liquid glass theme provider, background blobs, global styles
/components/UploadZone.tsx     — Drag-and-drop log file input
/components/ScanAnimation.tsx  — Animated scan progress (Framer Motion)
/components/AnomalyList.tsx    — Ranked anomaly cards (configurable top-N)
/components/AnomalyDetail.tsx  — Expanded view: threat type, score, raw log line
/components/AIBriefingCard.tsx — Streams Gemini output into 3 structured sections
/components/MetricsChart.tsx   — Recharts event timeline with anomaly markers
/lib/api.ts                    — SSE client for /api/analyze
/lib/types.ts                  — Shared TypeScript types
```

**Key frontend decisions:**
- TanStack Query manages the SSE stream state (loading → anomalies arrived → briefing streaming → done).
- `NEXT_PUBLIC_API_URL` in `.env.local` points to the backend (default `http://localhost:8000`).

### Processing Pipeline (in order)

```
Upload → parse() → engineer_features() → scale() → isolation_forest()
       → classify_threats()  ← NEW step, after IF flags anomalies
       → rank_by_severity()
       → SSE: emit anomalies
       → stream_gemini_briefing()
       → SSE: emit briefing chunks
       → SSE: close
```

---

## Development & Deployment Steps

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate  # venv/Scripts/activate on Windows
pip install -r requirements.txt
cp .env.example .env           # add GEMINI_API_KEY (free from aistudio.google.com)
python demo_data.py            # generate demo logs
uvicorn main:app --reload
```

`requirements.txt` (all free/OSS):
```
fastapi
uvicorn[standard]
python-multipart
scikit-learn
pandas
numpy
python-dotenv
google-generativeai
pydantic
sse-starlette
```

### Frontend
```bash
cd frontend
npx create-next-app@latest .   # accept defaults, enable TypeScript + Tailwind + App Router
npx shadcn@latest init         # use "New York" style, stone base color (warm, matches liquid glass bg)
npx shadcn@latest add card badge button progress separator
npm install framer-motion recharts @tanstack/react-query lucide-react
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

### One-Command Local Setup (Docker Compose)
A `docker-compose.yml` at the repo root brings up both services:
```
docker compose up --build
# Frontend → http://localhost:3000
# Backend  → http://localhost:8000
```

---

## Free Services & Libraries Summary

| Tool | Purpose | Cost |
|---|---|---|
| FastAPI + uvicorn | Backend framework | Free / OSS |
| scikit-learn | Isolation Forest ML | Free / OSS |
| google-generativeai | Gemini 2.0 Flash | Free tier (AI Studio) |
| Next.js (latest) | Frontend framework | Free / OSS |
| Shadcn UI | Component library | Free / OSS |
| Framer Motion | Animations | Free / OSS |
| TanStack Query | Server state management | Free / OSS |
| Recharts | Charts | Free / OSS |
| Docker Compose | Local orchestration | Free |

