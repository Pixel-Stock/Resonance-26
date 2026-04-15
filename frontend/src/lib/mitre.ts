import type { ThreatType } from "./types";

export interface MitreTechnique {
  tactic: string;
  tacticId: string;
  technique: string;
  techniqueId: string;
  url: string;
}

export const MITRE_MAP: Record<ThreatType, MitreTechnique> = {
  BRUTE_FORCE: {
    tactic: "Credential Access",
    tacticId: "TA0006",
    technique: "Brute Force",
    techniqueId: "T1110",
    url: "https://attack.mitre.org/techniques/T1110/",
  },
  ACCOUNT_COMPROMISE: {
    tactic: "Credential Access",
    tacticId: "TA0006",
    technique: "Valid Accounts",
    techniqueId: "T1078",
    url: "https://attack.mitre.org/techniques/T1078/",
  },
  LATERAL_MOVEMENT: {
    tactic: "Lateral Movement",
    tacticId: "TA0008",
    technique: "Remote Services",
    techniqueId: "T1021",
    url: "https://attack.mitre.org/techniques/T1021/",
  },
  EXTERNAL_ACCESS: {
    tactic: "Initial Access",
    tacticId: "TA0001",
    technique: "External Remote Services",
    techniqueId: "T1133",
    url: "https://attack.mitre.org/techniques/T1133/",
  },
  PERSISTENCE: {
    tactic: "Persistence",
    tacticId: "TA0003",
    technique: "Create or Modify System Process",
    techniqueId: "T1543",
    url: "https://attack.mitre.org/techniques/T1543/",
  },
  PRIVILEGE_ESCALATION: {
    tactic: "Privilege Escalation",
    tacticId: "TA0004",
    technique: "Abuse Elevation Control",
    techniqueId: "T1548",
    url: "https://attack.mitre.org/techniques/T1548/",
  },
  SYSTEM_TAMPERING: {
    tactic: "Defense Evasion",
    tacticId: "TA0005",
    technique: "Impair Defenses",
    techniqueId: "T1562",
    url: "https://attack.mitre.org/techniques/T1562/",
  },
  UNKNOWN: {
    tactic: "Defense Evasion",
    tacticId: "TA0005",
    technique: "Masquerading",
    techniqueId: "T1036",
    url: "https://attack.mitre.org/techniques/T1036/",
  },
};
