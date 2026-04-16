import type { ThreatType } from "./types";

export interface ThreatExplanation {
  diagnostic: string;
  techDetail: string;
}

export const THREAT_DESCRIPTIONS: Record<ThreatType, ThreatExplanation> = {
  BRUTE_FORCE: {
    diagnostic: "SSH password brute-force attack in progress",
    techDetail:
      "Automated tooling (Hydra / Medusa / Ncrack) is systematically trying username+password combinations against your SSH daemon. " +
      "Every 'Failed password' line in auth.log is one attempt. " +
      "High-rate attacks (100+/min) indicate a dictionary or credential-stuffing campaign — the attacker has a wordlist or a breached credential database.",
  },
  ACCOUNT_COMPROMISE: {
    diagnostic: "Brute-force succeeded — valid credentials obtained",
    techDetail:
      "After a sustained failure campaign, a login was accepted. The attacker now holds working credentials for this account. " +
      "Treat every action this user takes going forward as attacker-controlled. " +
      "Immediately audit new SSH authorized_keys, cron jobs, sudo rules, and any files written in the last session.",
  },
  LATERAL_MOVEMENT: {
    diagnostic: "Attacker pivoting across hosts via SSH",
    techDetail:
      "One account is authenticating to multiple different internal hosts in rapid succession. " +
      "This is a post-compromise spreading technique: the attacker uses credentials stolen from one machine to reach others on the same network. " +
      "Each new host they access is a fresh foothold — check all destination hosts for backdoors.",
  },
  PERSISTENCE: {
    diagnostic: "Backdoor cron job planted in /tmp or /var/tmp",
    techDetail:
      "/tmp and /var/tmp are world-writable and survive reboots. " +
      "A cron job scheduled to run a script from these directories means the attacker has established an auto-executing backdoor. " +
      "Even if you change the account password, this cron entry will continue firing on schedule. " +
      "Check: crontab -l for all users, /etc/cron.d/, and /var/spool/cron/.",
  },
  EXTERNAL_ACCESS: {
    diagnostic: "Successful login from an internet-routable IP",
    techDetail:
      "An externally routable (public internet) IP address authenticated successfully to your SSH service. " +
      "If this IP belongs to a VPN exit node, Tor relay, or unknown datacenter, this is almost certainly unauthorized remote access. " +
      "Review the session immediately: check 'last', 'who', and bash history for commands run during this login.",
  },
  PRIVILEGE_ESCALATION: {
    diagnostic: "Root shell obtained via sudo",
    techDetail:
      "A sudo command was used to spawn /bin/bash or /bin/sh running as root. " +
      "The attacker has escalated from a limited user account to full system administrator. " +
      "With root they can: disable logging (auditd), install rootkits, add new backdoor accounts, " +
      "read /etc/shadow for all password hashes, and exfiltrate any file on the system.",
  },
  SYSTEM_TAMPERING: {
    diagnostic: "Network interface in promiscuous mode — all traffic being captured",
    techDetail:
      "A network interface was placed in promiscuous mode, meaning packet capture software (Wireshark / tcpdump / ettercap) is actively running. " +
      "Every unencrypted packet transiting this machine is being recorded: cleartext passwords, session tokens, API keys, and internal service communications. " +
      "This is also a strong indicator the attacker is setting up a man-in-the-middle proxy.",
  },
  UNKNOWN: {
    diagnostic: "Statistical outlier flagged by Isolation Forest ML model",
    techDetail:
      "The machine learning model detected this event as a statistical outlier relative to the behavioral baseline. " +
      "No specific SIEM correlation rule matched, but the feature vector (timing patterns, failure counts, user behavior, port diversity) " +
      "is abnormal enough to warrant manual investigation. Correlate with other events from the same IP or user.",
  },
};
