// frontend/lib/api.ts — All backend API calls for Log-Sentinel

import { AnalysisResult, Anomaly } from './types';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function analyzeFile(file: File): Promise<AnalysisResult> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${BACKEND}/analyze`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function analyzeText(text: string): Promise<AnalysisResult> {
  const form = new FormData();
  form.append('raw_text', text);

  const res = await fetch(`${BACKEND}/analyze`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function generateBriefing(
  anomalyId: string,
  anomalyData: Anomaly
): Promise<string> {
  const res = await fetch(`${BACKEND}/briefing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anomaly_id: anomalyId, anomaly_data: anomalyData }),
  });

  if (!res.ok) {
    throw new Error(`Briefing error: ${res.status}`);
  }
  const data = await res.json();
  return data.briefing as string;
}

export async function loadDemoLog(): Promise<string> {
  const res = await fetch(`${BACKEND}/demo-log`);
  if (!res.ok) {
    throw new Error(`Demo log error: ${res.status}`);
  }
  return res.text();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
