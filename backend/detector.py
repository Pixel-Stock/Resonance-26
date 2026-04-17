"""
Anomaly detection using Isolation Forest with feature scaling.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from config import DEFAULT_CONTAMINATION
from features import FEATURE_COLUMNS


def detect_anomalies(
    df: pd.DataFrame,
    contamination: float = DEFAULT_CONTAMINATION,
) -> pd.DataFrame:
    """
    Run Isolation Forest on the feature columns of *df*.

    Adds two columns:
        - anomaly_label:  1 = normal, -1 = anomaly
        - isolation_score: raw decision_function score (more negative = more anomalous)

    Returns the full DataFrame (both normal and anomalous rows).
    """
    if df.empty or len(df) < 2:
        df["anomaly_label"] = 1
        df["isolation_score"] = 0.0
        return df

    X = df[FEATURE_COLUMNS].fillna(0).values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(
        contamination=contamination,
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    df = df.copy()
    df["anomaly_label"] = model.predict(X_scaled)
    df["isolation_score"] = model.decision_function(X_scaled)

    return df
