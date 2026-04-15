"""
Log-Sentinel FastAPI backend.

Single SSE endpoint that runs the full pipeline:
  upload → parse → features → detect → correlate → classify → rank → stream briefing
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import traceback

from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI, File, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from alerts import fire_alerts
from briefing import stream_briefing, generate_briefing_sync
from config import (
    ALLOWED_EXTENSIONS,
    DEFAULT_CONTAMINATION,
    DEFAULT_TOP_N,
    MAX_UPLOAD_SIZE_MB,
)
from correlator import correlate
from detector import detect_anomalies
from features import engineer_features
from parser import parse_logs
from ranker import rank_anomalies

# ── Live monitoring state ─────────────────────────────────────────────────────
# Each connected /api/watch client gets its own queue entry here.
_watch_queues: list[asyncio.Queue] = []
# Hashes of raw log lines already alerted on — prevents duplicate alerts.
_alerted_hashes: set[str] = set()

app = FastAPI(
    title="Log-Sentinel",
    description="AI-powered cybersecurity anomaly detection",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _validate_file(file: UploadFile) -> str | None:
    """Return an error message if the file is invalid, else None."""
    if file.filename:
        ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext and ext not in ALLOWED_EXTENSIONS:
            return f"Invalid file type '{ext}'. Allowed: {ALLOWED_EXTENSIONS}"
    if file.size and file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        return f"File too large. Max {MAX_UPLOAD_SIZE_MB}MB."
    return None


@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    contamination: float = Query(DEFAULT_CONTAMINATION, ge=0.001, le=0.5),
    top_n: int = Query(DEFAULT_TOP_N, ge=1, le=100),
):
    """
    Upload a log file and receive an SSE stream with:
      1. event: anomalies  — ranked anomaly list (JSON)
      2. event: briefing_chunk — Gemini response text chunks
      3. event: briefing_done — final assembled JSON briefing
      4. event: error — if something goes wrong
    """
    # Validate
    err = _validate_file(file)
    if err:
        async def error_stream():
            yield {"event": "error", "data": json.dumps({"detail": err})}
        return EventSourceResponse(error_stream())

    # Read file
    raw_bytes = await file.read()
    raw_text = raw_bytes.decode("utf-8", errors="replace")

    async def event_generator():
        try:
            # 1. Parse
            logs = parse_logs(raw_text)
            if not logs:
                yield {"event": "error", "data": json.dumps({"detail": "No parseable log entries found."})}
                return

            # 2. Feature engineering
            df = engineer_features(logs)

            # 3. Anomaly detection (Isolation Forest — statistical outliers)
            df = detect_anomalies(df, contamination=contamination)

            # 4. Event correlation & Rules engine (generates distinct incidents)
            incident_list = correlate(df)

            # 5. Rank & Sort independent anomalies
            anomalies = rank_anomalies(incident_list, top_n=top_n)

            # Emit anomalies
            rule_flagged = len([a for a in anomalies if a.threat_score > 0])
            anomalies_data = [a.model_dump(mode="json") for a in anomalies]
            yield {
                "event": "anomalies",
                "data": json.dumps({
                    "anomalies": anomalies_data,
                    "total_logs_parsed": len(logs),
                    "total_anomalies": int((df["anomaly_label"] == -1).sum()) if "anomaly_label" in df.columns else len(anomalies),
                    "rule_flagged": rule_flagged,
                }),
            }

            if not anomalies:
                yield {
                    "event": "briefing_done",
                    "data": json.dumps({
                        "executive_summary": "No anomalies detected in the uploaded logs.",
                        "technical_details": "The Isolation Forest model did not flag any entries as anomalous at the configured contamination rate.",
                        "remediation_steps": [],
                    }),
                }
                return

            # 6. Stream AI briefing
            full_text = ""
            try:
                async for chunk in stream_briefing(anomalies):
                    full_text += chunk
                    yield {"event": "briefing_chunk", "data": chunk}

                # Parse the assembled JSON
                briefing = json.loads(full_text)
                yield {"event": "briefing_done", "data": json.dumps(briefing)}
            except Exception:
                # Fallback: try non-streaming
                try:
                    briefing = generate_briefing_sync(anomalies)
                    yield {
                        "event": "briefing_done",
                        "data": briefing.model_dump_json(),
                    }
                except Exception as e:
                    yield {
                        "event": "briefing_done",
                        "data": json.dumps({
                            "executive_summary": f"AI briefing unavailable: {e}",
                            "technical_details": "Set GROQ_API_KEY in .env to enable AI briefings.",
                            "remediation_steps": ["Configure a valid Groq API key."],
                        }),
                    }

        except Exception as e:
            traceback.print_exc()
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}

    return EventSourceResponse(event_generator())


@app.get("/api/demo")
async def demo(
    contamination: float = Query(DEFAULT_CONTAMINATION, ge=0.001, le=0.5),
    top_n: int = Query(DEFAULT_TOP_N, ge=1, le=100),
):
    """Run the full pipeline on the pre-generated demo_logs.log file."""
    demo_path = os.path.join(os.path.dirname(__file__), "demo_logs.log")

    async def event_generator():
        try:
            if not os.path.exists(demo_path):
                yield {"event": "error", "data": json.dumps({"detail": "demo_logs.log not found. Run: python demo_data.py"})}
                return

            with open(demo_path, "r", encoding="utf-8") as f:
                raw_text = f.read()

            logs = parse_logs(raw_text)
            df = engineer_features(logs)
            df = detect_anomalies(df, contamination=contamination)
            incident_list = correlate(df)
            anomalies = rank_anomalies(incident_list, top_n=top_n)

            yield {
                "event": "anomalies",
                "data": json.dumps({
                    "anomalies": [a.model_dump(mode="json") for a in anomalies],
                    "total_logs_parsed": len(logs),
                    "rule_flagged": len([a for a in anomalies if a.threat_score > 0]),
                    "total_anomalies": int((df["anomaly_label"] == -1).sum()) if "anomaly_label" in df.columns else len(anomalies),
                }),
            }

            if not anomalies:
                yield {"event": "briefing_done", "data": json.dumps({
                    "executive_summary": "No anomalies detected.",
                    "technical_details": "Nothing flagged at current contamination rate.",
                    "remediation_steps": [],
                })}
                return

            full_text = ""
            try:
                async for chunk in stream_briefing(anomalies):
                    full_text += chunk
                    yield {"event": "briefing_chunk", "data": chunk}
                briefing = json.loads(full_text)
                yield {"event": "briefing_done", "data": json.dumps(briefing)}
            except Exception:
                try:
                    briefing = generate_briefing_sync(anomalies)
                    yield {"event": "briefing_done", "data": briefing.model_dump_json()}
                except Exception as e:
                    yield {"event": "briefing_done", "data": json.dumps({
                        "executive_summary": f"AI briefing unavailable: {e}",
                        "technical_details": "Configure GROQ_API_KEY in .env",
                        "remediation_steps": ["Add a valid Groq API key."],
                    })}
        except Exception as e:
            traceback.print_exc()
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}

    return EventSourceResponse(event_generator())


@app.post("/api/briefing")
async def briefing_endpoint(request: Request):
    """
    Accept a list of anomalies and stream a Gemini AI briefing via SSE.
    Used by the frontend live monitor to auto-generate summaries.
    """
    from schemas import Anomaly as AnomalySchema
    body = await request.json()
    anomaly_dicts = body.get("anomalies", [])
    try:
        anomalies = [AnomalySchema.model_validate(a) for a in anomaly_dicts]
    except Exception as e:
        async def err():
            yield {"event": "briefing_done", "data": json.dumps({
                "executive_summary": f"Could not parse anomalies: {e}",
                "technical_details": "", "remediation_steps": [],
            })}
        return EventSourceResponse(err())

    async def event_generator():
        full_text = ""
        try:
            async for chunk in stream_briefing(anomalies):
                full_text += chunk
                yield {"event": "briefing_chunk", "data": chunk}
            briefing = json.loads(full_text)
            yield {"event": "briefing_done", "data": json.dumps(briefing)}
        except Exception:
            try:
                briefing = generate_briefing_sync(anomalies)
                yield {"event": "briefing_done", "data": briefing.model_dump_json()}
            except Exception as e2:
                yield {"event": "briefing_done", "data": json.dumps({
                    "executive_summary": f"AI briefing unavailable: {e2}",
                    "technical_details": "", "remediation_steps": [],
                })}

    return EventSourceResponse(event_generator())


@app.post("/api/ingest")
async def ingest(request: Request):
    """
    Receive log lines from the target site and run the detection pipeline.
    New CRITICAL/HIGH anomalies trigger email + Telegram alerts and are
    pushed to all connected /api/watch SSE clients.
    """
    body = await request.json()
    raw_text = body.get("lines", "")
    if not raw_text.strip():
        return {"anomalies": [], "new": 0}

    try:
        logs = parse_logs(raw_text)
        if not logs:
            return {"anomalies": [], "new": 0}

        df = engineer_features(logs)
        df = detect_anomalies(df, contamination=DEFAULT_CONTAMINATION)
        incident_list = correlate(df)
        anomalies = rank_anomalies(incident_list, top_n=DEFAULT_TOP_N)

        new_anomalies = []
        for anomaly in anomalies:
            h = hashlib.md5(anomaly.parsed_log.raw.encode()).hexdigest()
            if h not in _alerted_hashes:
                _alerted_hashes.add(h)
                new_anomalies.append(anomaly)

        for anomaly in new_anomalies:
            # Fire alerts in a background thread (non-blocking)
            if anomaly.severity in ("CRITICAL", "HIGH"):
                asyncio.create_task(asyncio.to_thread(fire_alerts, anomaly))

            data = anomaly.model_dump(mode="json")
            for q in list(_watch_queues):
                await q.put(data)

        return {
            "anomalies": [a.model_dump(mode="json") for a in anomalies],
            "new": len(new_anomalies),
        }
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e), "anomalies": [], "new": 0}


@app.get("/api/watch")
async def watch():
    """
    SSE stream for the frontend live monitor.
    Sends anomaly events as they are detected via /api/ingest.
    """
    queue: asyncio.Queue = asyncio.Queue()
    _watch_queues.append(queue)

    async def event_generator():
        # Fresh session — clear deduplication so alerts fire again
        _alerted_hashes.clear()
        try:
            yield {"event": "connected", "data": json.dumps({"status": "watching"})}
            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=25)
                    yield {"event": "anomaly", "data": json.dumps(data)}
                except asyncio.TimeoutError:
                    # Keepalive ping so the connection stays alive
                    yield {"event": "ping", "data": "{}"}
        finally:
            if queue in _watch_queues:
                _watch_queues.remove(queue)

    return EventSourceResponse(event_generator())


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "log-sentinel"}

