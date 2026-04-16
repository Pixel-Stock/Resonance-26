import type { AnalysisResult, AIBriefing, Severity } from "./types";

export async function downloadPDFReport(
  result: AnalysisResult,
  briefing: AIBriefing | null,
  sourceFilename: string
) {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const M = 18;
  const CW = W - M * 2;
  let y = M;

  function newPageIfNeeded(needed = 14) {
    if (y + needed > 280) {
      doc.addPage();
      y = M;
    }
  }

  function sectionHeader(title: string) {
    newPageIfNeeded(18);
    y += 3;
    doc.setFillColor(245, 243, 255);
    doc.rect(M, y, CW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(109, 40, 217);
    doc.text(title.toUpperCase(), M + 3, y + 5);
    y += 11;
  }

  function para(text: string, color: [number, number, number] = [51, 65, 85]): void {
    newPageIfNeeded(10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, CW) as string[];
    doc.text(lines, M, y);
    y += lines.length * 4.8 + 1;
  }

  // ── Cover header ─────────────────────────────────────────────────────────
  doc.setFillColor(109, 40, 217);
  doc.roundedRect(M, y, CW, 20, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("LOG SENTINEL", M + 5, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(221, 214, 254);
  doc.text("Security Analysis Report", M + 5, y + 15);

  y += 26;

  // ── Meta ─────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString()}`, M, y);
  doc.text(`Source: ${sourceFilename}`, W - M, y, { align: "right" });
  y += 10;

  // ── Summary boxes ────────────────────────────────────────────────────────
  sectionHeader("Summary");

  const sevCounts: Record<Severity, number> = {
    CRITICAL: result.anomalies.filter((a) => a.severity === "CRITICAL").length,
    HIGH:     result.anomalies.filter((a) => a.severity === "HIGH").length,
    MEDIUM:   result.anomalies.filter((a) => a.severity === "MEDIUM").length,
    LOW:      result.anomalies.filter((a) => a.severity === "LOW").length,
  };

  const summaryItems: { label: string; value: string; color: [number, number, number] }[] = [
    { label: "Logs Parsed",   value: result.total_logs_parsed.toString(), color: [30, 41, 59] },
    { label: "Anomalies",     value: result.total_anomalies.toString(),   color: [30, 41, 59] },
    { label: "Rule Flagged",  value: result.rule_flagged.toString(),       color: [30, 41, 59] },
    { label: "Critical",      value: sevCounts.CRITICAL.toString(),        color: [190, 18, 60] },
    { label: "High",          value: sevCounts.HIGH.toString(),            color: [154, 52, 18] },
    { label: "Low",           value: sevCounts.LOW.toString(),             color: [19, 78, 74] },
  ];

  const boxW = CW / 3;
  summaryItems.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = M + col * boxW;
    const by = y + row * 20;

    doc.setFillColor(248, 246, 255);
    doc.roundedRect(bx + 1, by, boxW - 2, 17, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...item.color);
    doc.text(item.value, bx + boxW / 2, by + 9, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, bx + boxW / 2, by + 14, { align: "center" });
  });

  y += Math.ceil(summaryItems.length / 3) * 20 + 6;

  // ── AI Briefing ───────────────────────────────────────────────────────────
  if (briefing?.executive_summary && !briefing.executive_summary.includes("RESOURCE_EXHAUSTED")) {
    sectionHeader("Executive Summary");
    para(briefing.executive_summary);

    sectionHeader("Technical Details");
    para(briefing.technical_details);

    if (briefing.remediation_steps.length > 0) {
      sectionHeader("Remediation Steps");
      briefing.remediation_steps.forEach((step, i) => {
        para(`${i + 1}. ${step}`);
      });
    }
  }

  // ── Anomaly table ─────────────────────────────────────────────────────────
  const topN = Math.min(result.anomalies.length, 25);
  sectionHeader(`Top Anomalies (${topN} of ${result.total_anomalies})`);

  const cols = [
    { label: "IP Address",   x: M,         w: 34 },
    { label: "Threat Type",  x: M + 34,    w: 46 },
    { label: "Severity",     x: M + 80,    w: 22 },
    { label: "Score",        x: M + 102,   w: 18 },
    { label: "Timestamp",    x: M + 120,   w: CW - 120 },
  ];

  newPageIfNeeded(12);
  doc.setFillColor(237, 233, 254);
  doc.rect(M, y, CW, 6.5, "F");
  cols.forEach((col) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(109, 40, 217);
    doc.text(col.label, col.x + 1, y + 4.5);
  });
  y += 7.5;

  const SEV_COLORS: Record<Severity, [number, number, number]> = {
    CRITICAL: [190, 18, 60],
    HIGH:     [154, 52, 18],
    MEDIUM:   [120, 53, 15],
    LOW:      [19, 78, 74],
  };

  result.anomalies.slice(0, topN).forEach((a, idx) => {
    newPageIfNeeded(8);
    if (idx % 2 === 0) {
      doc.setFillColor(250, 249, 252);
      doc.rect(M, y - 1, CW, 6.5, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(a.parsed_log.ip || "—", cols[0].x + 1, y + 3.5);
    doc.text(String(a.threat_type ?? "UNKNOWN").replace(/_/g, " "), cols[1].x + 1, y + 3.5);

    doc.setTextColor(...SEV_COLORS[a.severity]);
    doc.text(a.severity, cols[2].x + 1, y + 3.5);

    doc.setTextColor(30, 41, 59);
    doc.text(a.composite_score.toFixed(2), cols[3].x + 1, y + 3.5);
    doc.text(
      a.parsed_log.timestamp ? a.parsed_log.timestamp.slice(0, 19) : "—",
      cols[4].x + 1,
      y + 3.5
    );
    y += 6.5;
  });

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages = (doc.internal as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Log Sentinel — Confidential Security Report", M, 290);
    doc.text(`Page ${p} of ${totalPages}`, W - M, 290, { align: "right" });
  }

  doc.save(`log-sentinel-${new Date().toISOString().slice(0, 10)}.pdf`);
}
