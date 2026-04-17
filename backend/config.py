"""
Log-Sentinel configuration — threat weights, model defaults, and app settings.
"""

# Isolation Forest defaults
DEFAULT_CONTAMINATION = 0.03
DEFAULT_TOP_N = 10
MAX_UPLOAD_SIZE_MB = 10
ALLOWED_EXTENSIONS = {".log", ".txt"}

# Threat type weights for composite severity scoring
# Higher weight = more severe
THREAT_WEIGHTS: dict[str, float] = {
    "CRITICAL_SYSTEM_EVENT": 2.0,
    "ACCOUNT_COMPROMISE": 1.9,
    "PRIVILEGE_ESCALATION": 1.8,
    "LATERAL_MOVEMENT": 1.7,
    "IMPOSSIBLE_TRAVEL": 1.6,
    "BRUTE_FORCE": 1.5,
    "SUSPICIOUS_PERSISTENCE": 1.5,
    "DATA_EXFILTRATION": 1.4,
    "PORT_SCAN": 1.0,
    "SUSPICIOUS_ACTIVITY": 1.2,
    "UNKNOWN": 1.0,
}

# Behavioral feature engineering windows
FEATURE_WINDOW_MINUTES = 5

# Groq model
GROQ_MODEL = "llama-3.3-70b-versatile"
