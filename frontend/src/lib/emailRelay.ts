/**
 * EmailJS relay — sends alert emails directly from the browser.
 *
 * Setup (one-time):
 *   1. emailjs.com → Create service  → copy Service ID
 *   2. emailjs.com → Email Templates → Create template → copy Template ID
 *      Paste the HTML from src/lib/email-template.html into the template body (HTML mode).
 *   3. emailjs.com → Account → API Keys → copy Public Key
 *   4. Fill in the three constants + TO_EMAIL below.
 *
 * The backend Gmail SMTP email can be disabled by removing GMAIL_APP_PASSWORD from .env
 * once this is confirmed working.
 */

import emailjs from "@emailjs/browser";
import type { Anomaly } from "@/lib/types";

// ── Fill these in after EmailJS dashboard setup ─────────────────────────────
const SERVICE_ID  = "service_4luwrgj";
const TEMPLATE_ID = "template_jg3mjbx";
const PUBLIC_KEY  = "0AkzZ0IAdkTYwURuP";
const TO_EMAIL    = "janhavii.salunkhe@gmail.com";
// ────────────────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH:     "#ea580c",
  MEDIUM:   "#d97706",
  LOW:      "#65a30d",
};

function fmtThreatType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtAction(a: string): string {
  return a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    return `${date} · ${time} UTC`;
  } catch {
    return ts;
  }
}

function fmtTimestampShort(ts: string): string {
  try {
    const d = new Date(ts);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${date} ${time}`;
  } catch {
    return ts.slice(0, 16);
  }
}

function confidenceLabel(score: number): string {
  if (score <= -0.2) return "Very high confidence";
  if (score <= -0.1) return "High confidence";
  if (score <= 0)    return "Medium confidence";
  if (score <= 0.1)  return "Low confidence";
  return "Very low confidence";
}

function confidenceDots(score: number): string {
  const filled = score <= -0.2 ? 5 : score <= -0.1 ? 4 : score <= 0 ? 3 : score <= 0.1 ? 2 : 1;
  return "●".repeat(filled) + "○".repeat(5 - filled);
}

export async function sendEmailAlert(anomaly: Anomaly): Promise<void> {
  const sev   = anomaly.severity as string;
  const ts    = anomaly.parsed_log.timestamp as unknown as string;
  const ip    = anomaly.parsed_log.ip;
  const user  = anomaly.parsed_log.user;
  const action = anomaly.parsed_log.action;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const host  = (anomaly.parsed_log as any).host as string | undefined;

  const alertName = fmtThreatType(anomaly.threat_type as string);

  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email:          TO_EMAIL,
      severity:          sev,
      severity_color:    SEVERITY_COLORS[sev] ?? "#6b7280",
      alert_name:        alertName,
      timestamp:         fmtTimestamp(ts),
      timestamp_short:   fmtTimestampShort(ts),
      host:              host || "—",
      source_ip:         ip  || "Not detected / internal process",
      user:              user   || "—",
      action:            action ? fmtAction(action) : "—",
      confidence_label:  confidenceLabel(anomaly.composite_score),
      confidence_dots:   confidenceDots(anomaly.composite_score),
      raw_log:           anomaly.parsed_log.raw.slice(0, 400),
      subject:           `[${sev}] ${alertName} · ${user || "—"} · ${host || "—"} · ${fmtTimestampShort(ts)}`,
    },
    PUBLIC_KEY,
  );
}
