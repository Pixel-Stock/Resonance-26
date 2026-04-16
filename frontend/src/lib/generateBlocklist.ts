import type { Anomaly, Severity } from "./types";

interface BlockIP {
  ip: string;
  severity: Severity;
  threatType: string;
  user: string;
  timestamp: string;
  attackChain: string;
}

function collectAttackerIPs(anomalies: Anomaly[]): BlockIP[] {
  const seen = new Map<string, BlockIP>();

  // Severity rank — keep the worst record per IP
  const rank: Record<Severity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

  for (const a of anomalies) {
    const ip = a.parsed_log.ip;
    if (!ip || ip === "unknown" || !isPublicIP(ip)) continue;

    const existing = seen.get(ip);
    if (!existing || rank[a.severity] > rank[existing.severity]) {
      seen.set(ip, {
        ip,
        severity: a.severity,
        threatType: a.threat_type.replace(/_/g, " "),
        user: a.parsed_log.user || "—",
        timestamp: a.parsed_log.timestamp
          ? new Date(a.parsed_log.timestamp).toISOString().replace("T", " ").slice(0, 19) + " UTC"
          : "—",
        attackChain: a.attack_chain?.[0] ?? "",
      });
    }
  }

  // Sort by severity desc
  const order: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return [...seen.values()].sort((a, b) => order[a.severity] - order[b.severity]);
}

function isPublicIP(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => isNaN(n) || n < 0 || n > 255)) return false;
  if (p[0] === 10) return false;
  if (p[0] === 127) return false;
  if (p[0] === 192 && p[1] === 168) return false;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return false;
  if (p[0] === 0) return false;
  return true;
}

function fmtSeverityLine(s: Severity): string {
  return { CRITICAL: "# [CRITICAL]", HIGH: "# [HIGH]   ", MEDIUM: "# [MEDIUM] ", LOW: "# [LOW]    " }[s];
}

export function downloadBlocklist(anomalies: Anomaly[], sourceLabel: string): void {
  const ips = collectAttackerIPs(anomalies);
  if (ips.length === 0) {
    alert("No public attacker IPs found in this analysis.");
    return;
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const lines: string[] = [];

  // ── Header ────────────────────────────────────────────────────────────────
  lines.push("#!/usr/bin/env bash");
  lines.push("# ============================================================");
  lines.push("# Log Sentinel — Attacker IP Blocklist");
  lines.push(`# Generated : ${now}`);
  lines.push(`# Source    : ${sourceLabel}`);
  lines.push(`# IPs       : ${ips.length} unique attacker addresses`);
  lines.push("# ============================================================");
  lines.push("#");
  lines.push("# USAGE:");
  lines.push("#   sudo bash blocklist.sh          → apply ufw rules");
  lines.push("#   bash blocklist.sh --dry-run      → print rules, do not apply");
  lines.push("#   bash blocklist.sh --iptables     → use iptables instead");
  lines.push("#   bash blocklist.sh --fail2ban     → write fail2ban jail");
  lines.push("#");
  lines.push("");

  // ── Dry-run / mode parsing ────────────────────────────────────────────────
  lines.push('DRY_RUN=false');
  lines.push('MODE="ufw"');
  lines.push('for arg in "$@"; do');
  lines.push('  case $arg in');
  lines.push('    --dry-run)   DRY_RUN=true ;;');
  lines.push('    --iptables)  MODE="iptables" ;;');
  lines.push('    --fail2ban)  MODE="fail2ban" ;;');
  lines.push('  esac');
  lines.push('done');
  lines.push("");
  lines.push('run() { if $DRY_RUN; then echo "  [dry-run] $*"; else "$@"; fi; }');
  lines.push("");

  // ── UFW section ───────────────────────────────────────────────────────────
  lines.push('if [ "$MODE" = "ufw" ]; then');
  lines.push(`  echo "Log Sentinel — applying ${ips.length} ufw deny rules..."`);
  for (const b of ips) {
    lines.push(`  ${fmtSeverityLine(b.severity)} ${b.threatType} | User: ${b.user} | ${b.timestamp}`);
    if (b.attackChain) lines.push(`  #           ${b.attackChain}`);
    lines.push(`  run ufw deny from ${b.ip} to any`);
  }
  lines.push('  run ufw reload');
  lines.push(`  echo "Done. ${ips.length} IPs blocked."`);
  lines.push("fi");
  lines.push("");

  // ── iptables section ──────────────────────────────────────────────────────
  lines.push('if [ "$MODE" = "iptables" ]; then');
  lines.push(`  echo "Log Sentinel — applying ${ips.length} iptables DROP rules..."`);
  for (const b of ips) {
    lines.push(`  ${fmtSeverityLine(b.severity)} ${b.threatType} | User: ${b.user}`);
    lines.push(`  run iptables -I INPUT -s ${b.ip} -j DROP`);
  }
  lines.push(`  echo "Done. ${ips.length} IPs blocked."`);
  lines.push("fi");
  lines.push("");

  // ── fail2ban section ──────────────────────────────────────────────────────
  lines.push('if [ "$MODE" = "fail2ban" ]; then');
  lines.push('  JAIL_FILE="/etc/fail2ban/jail.d/log-sentinel.conf"');
  lines.push('  echo "Writing fail2ban jail to $JAIL_FILE..."');
  lines.push("  run tee \"\$JAIL_FILE\" > /dev/null << 'EOF'");
  lines.push("[log-sentinel-blocklist]");
  lines.push("enabled  = true");
  lines.push("filter   = log-sentinel");
  lines.push("action   = iptables-allports");
  lines.push(`bantime  = -1`);
  lines.push(`banip    = ${ips.map((b) => b.ip).join(" ")}`);
  lines.push("EOF");
  lines.push('  run fail2ban-client reload');
  lines.push(`  echo "Done. ${ips.length} IPs added to fail2ban jail."`);
  lines.push("fi");
  lines.push("");

  // ── Plain IP list at the bottom ───────────────────────────────────────────
  lines.push("# ------------------------------------------------------------");
  lines.push("# Plain IP list (for copy-paste into other tools):");
  lines.push("# ------------------------------------------------------------");
  for (const b of ips) {
    lines.push(`# ${b.ip.padEnd(18)} ${b.severity.padEnd(10)} ${b.threatType}`);
  }

  const blob = new Blob([lines.join("\n")], { type: "text/x-shellscript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `log-sentinel-blocklist-${new Date().toISOString().slice(0, 10)}.sh`;
  a.click();
  URL.revokeObjectURL(url);
}
