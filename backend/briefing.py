"""
AI briefing generation using Groq.

Uses the groq SDK with native JSON parsing output and streaming.
"""

from __future__ import annotations

import json
import os
from collections.abc import AsyncGenerator

from groq import Groq, AsyncGroq

from config import GROQ_MODEL
from schemas import AIBriefing, Anomaly


_SYSTEM_PROMPT = """\
You are an expert cybersecurity analyst at a Security Operations Center (SOC).
You are given a list of anomalies detected by an Isolation Forest model in system logs.

Produce a security briefing in valid JSON with exactly these keys:
- "executive_summary": A concise 2-3 sentence summary for a non-technical executive.
- "technical_details": A detailed technical analysis (3-5 sentences) explaining the attack patterns, IOCs, and threat vectors observed.
- "remediation_steps": An array of 3-6 actionable remediation steps, each a single string.

Be specific — reference actual IPs, usernames, timestamps, and threat types from the data.
Return ONLY valid JSON with no trailing conversational text.
"""


def _format_anomalies_for_prompt(anomalies: list[Anomaly]) -> str:
    lines = []
    for a in anomalies:
        lines.append(
            f"[{a.severity.value}] {a.threat_type.value} | "
            f"IP={a.parsed_log.ip} User={a.parsed_log.user} "
            f"Action={a.parsed_log.action} Time={a.parsed_log.timestamp.isoformat()} "
            f"Score={a.composite_score} | Raw: {a.parsed_log.raw[:200]}"
        )
    return "\n".join(lines)


def _get_api_key() -> str:
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set in environment variables")
    return api_key


def generate_briefing_sync(anomalies: list[Anomaly]) -> AIBriefing:
    """Non-streaming briefing generation — used as fallback."""
    client = Groq(api_key=_get_api_key())
    prompt = _format_anomalies_for_prompt(anomalies)
    
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    
    data = json.loads(response.choices[0].message.content)
    return AIBriefing(**data)


async def stream_briefing(anomalies: list[Anomaly]) -> AsyncGenerator[str, None]:
    """
    Stream the Groq response chunk by chunk.
    Yields raw text chunks — the caller assembles and parses the final JSON.
    """
    client = AsyncGroq(api_key=_get_api_key())
    prompt = _format_anomalies_for_prompt(anomalies)
    
    stream = await client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
        stream=True
    )
    
    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
