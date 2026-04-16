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
You are given a list of anomalies detected in system logs.

Produce a structured security briefing as valid JSON with EXACTLY these keys:

- "executive_summary": ONE sentence (max 20 words) stating what happened. No fluff. E.g. "A brute-force attack from 185.220.101.34 successfully compromised the root account on bastion-01."
- "threat_type_label": Short label for the primary threat. E.g. "Brute Force + Account Compromise" or "Lateral Movement".
- "risk_level": One of: CRITICAL, HIGH, MEDIUM, LOW — based on the worst severity seen.
- "time_range": Human-readable time window. Format: "HH:MM – HH:MM UTC". E.g. "18:22 – 18:45 UTC".
- "affected_hosts": Array of distinct hostnames or IPs that were targeted or accessed. E.g. ["bastion-01", "prod-app-01", "185.220.101.34"]. Max 8.
- "key_facts": Object with 4-6 key-value pairs summarising the most important technical facts. Keys should be short labels. Values should be specific data from the logs. E.g. {"Attack Vector": "SSH Port 22", "Failed Attempts": "847", "Attacker IP": "185.220.101.34", "Target User": "root", "First Seen": "18:22 UTC", "MITRE Tactic": "T1110 Credential Access"}.
- "technical_details": 2-3 sentences of technical analysis. Do NOT repeat the executive_summary. Focus on attack chain, IOCs, and what the attacker achieved.
- "remediation_steps": Array of 3-5 actionable steps. Each step must start with a verb. Be specific — reference actual IPs/users/paths from the data.

Be specific — use actual IPs, usernames, timestamps, and threat types from the provided data.
Return ONLY valid JSON. No markdown, no prose outside the JSON object.
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


async def stream_answer(anomalies: list[Anomaly], question: str, briefing: dict) -> AsyncGenerator[str, None]:
    """Stream a plain-text answer to an analyst follow-up question."""
    client = AsyncGroq(api_key=_get_api_key())
    context = _format_anomalies_for_prompt(anomalies)
    summary = briefing.get("executive_summary", "")

    stream = await client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a SOC analyst reviewing a live security incident. "
                    "Answer the analyst's follow-up question concisely and specifically — max 4 sentences. "
                    "Reference actual IPs, usernames, timestamps, and threat types from the provided data. "
                    "If the answer is not in the data, say so — do not guess."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Detected anomalies:\n{context}\n\n"
                    f"AI briefing summary: {summary}\n\n"
                    f"Analyst question: {question}"
                ),
            },
        ],
        temperature=0.2,
        stream=True,
    )

    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


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
