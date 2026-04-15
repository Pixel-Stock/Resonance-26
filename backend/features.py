"""
Behavioral feature engineering.

Aggregates parsed log entries into per-row numerical features suitable for
Isolation Forest. Each log line gets features describing the behavior of its
source IP within a rolling time window.
"""

from __future__ import annotations

import ipaddress
from datetime import timedelta

import numpy as np
import pandas as pd

from config import FEATURE_WINDOW_MINUTES
from schemas import ParsedLog


def _is_external_ip(ip: str) -> int:
    """Return 1 if IP is globally routable (internet-facing), 0 otherwise."""
    if not ip:
        return 0
    try:
        return 1 if ipaddress.ip_address(ip).is_global else 0
    except ValueError:
        return 0


def engineer_features(logs: list[ParsedLog]) -> pd.DataFrame:
    """
    Convert a list of ParsedLog entries into a DataFrame with engineered features.

    Features per row:
        - failed_logins_in_window: count of FAILED_LOGIN from same IP in the time window
        - unique_users_in_window:  unique usernames attempted from same IP in window
        - unique_ports_in_window:  unique destination ports from same IP in window
        - events_per_minute:       total events from same IP in window / window size
        - sudo_commands_in_window: count of SUDO_COMMAND from same user in window
        - hour_of_day:             0-23, captures time-of-day anomalies
        - is_failed_login:         1 if this event is a failed login, else 0
        - is_sudo:                 1 if this event is a sudo command, else 0
    """
    if not logs:
        return pd.DataFrame()

    rows = [log.model_dump() for log in logs]
    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values("timestamp").reset_index(drop=True)

    window = timedelta(minutes=FEATURE_WINDOW_MINUTES)

    # Pre-compute per-row windowed features
    failed_logins_in_window = []
    unique_users_in_window = []
    unique_ports_in_window = []
    events_per_minute = []
    sudo_commands_in_window = []

    for i, row in df.iterrows():
        ts = row["timestamp"]
        ip = row["ip"]
        user = row["user"]
        win_start = ts - window

        # IP-based window
        ip_mask = (df["ip"] == ip) & (df["timestamp"] >= win_start) & (df["timestamp"] <= ts)
        ip_window = df.loc[ip_mask]

        failed_logins_in_window.append(
            int((ip_window["action"] == "FAILED_LOGIN").sum())
        )
        unique_users_in_window.append(
            ip_window["user"].nunique()
        )
        ports = ip_window["port"].dropna()
        unique_ports_in_window.append(
            int(ports.nunique())
        )
        events_per_minute.append(
            len(ip_window) / max(FEATURE_WINDOW_MINUTES, 1)
        )

        # User-based window for privilege escalation
        if user:
            user_mask = (df["user"] == user) & (df["timestamp"] >= win_start) & (df["timestamp"] <= ts)
            user_window = df.loc[user_mask]
            sudo_commands_in_window.append(
                int((user_window["action"] == "SUDO_COMMAND").sum())
            )
        else:
            sudo_commands_in_window.append(0)

    # Compute unique_hosts_for_user and success_after_failures per row
    unique_hosts_for_user = []
    success_after_failures = []

    for i, row in df.iterrows():
        ts = row["timestamp"]
        ip = row["ip"]
        user = row["user"]
        action = row["action"]
        win_start = ts - window

        # unique hosts the same user logged into successfully within window
        if user and action == "ACCEPTED_LOGIN":
            user_logins = df[
                (df["user"] == user) &
                (df["action"] == "ACCEPTED_LOGIN") &
                (df["timestamp"] >= win_start) &
                (df["timestamp"] <= ts)
            ]
            unique_hosts_for_user.append(int(user_logins["host"].nunique()))
        else:
            unique_hosts_for_user.append(0)

        # for accepted logins: count failures from same IP before this event in window
        if action == "ACCEPTED_LOGIN" and ip:
            prior_fails = df[
                (df["ip"] == ip) &
                (df["action"] == "FAILED_LOGIN") &
                (df["timestamp"] >= win_start) &
                (df["timestamp"] < ts)
            ]
            success_after_failures.append(len(prior_fails))
        else:
            success_after_failures.append(0)

    df["failed_logins_in_window"] = failed_logins_in_window
    df["unique_users_in_window"] = unique_users_in_window
    df["unique_ports_in_window"] = unique_ports_in_window
    df["events_per_minute"] = events_per_minute
    df["sudo_commands_in_window"] = sudo_commands_in_window
    df["unique_hosts_for_user"] = unique_hosts_for_user
    df["success_after_failures"] = success_after_failures
    df["hour_of_day"] = df["timestamp"].dt.hour
    df["is_failed_login"] = (df["action"] == "FAILED_LOGIN").astype(int)
    df["is_sudo"] = (df["action"] == "SUDO_COMMAND").astype(int)
    df["is_external_ip"] = df["ip"].apply(_is_external_ip)
    df["is_root_user"] = df["user"].str.lower().isin(["root", "administrator", "admin"]).astype(int)
    df["is_promiscuous_mode"] = (df["action"] == "PROMISCUOUS_MODE").astype(int)
    df["is_suspicious_cron"] = (
        (df["action"] == "CRON_JOB") &
        df["raw"].str.contains(r"/tmp/|/var/tmp/", na=False, regex=True)
    ).astype(int)

    return df


FEATURE_COLUMNS = [
    "failed_logins_in_window",
    "unique_users_in_window",
    "unique_ports_in_window",
    "events_per_minute",
    "sudo_commands_in_window",
    "unique_hosts_for_user",
    "success_after_failures",
    "hour_of_day",
    "is_failed_login",
    "is_sudo",
    "is_external_ip",
    "is_root_user",
    "is_promiscuous_mode",
    "is_suspicious_cron",
]
