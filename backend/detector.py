"""
backend/detector.py — Isolation Forest wrapper for Log-Sentinel.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


class AnomalyDetector:
    def __init__(self):
        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42,
            max_samples="auto",
        )
        self.scaler = StandardScaler()
        self.feature_cols: list[str] = []

    def fit_predict(self, df: pd.DataFrame) -> np.ndarray:
        """
        Fit + predict on feature DataFrame.
        Returns normalized anomaly scores (0–1, 1 = most anomalous).
        """
        if df.empty:
            return np.array([])

        self.feature_cols = [c for c in df.columns if c != "idx"]
        X = df[self.feature_cols].fillna(0).values.astype(float)

        X_scaled = self.scaler.fit_transform(X)
        raw_scores = self.model.fit(X_scaled).score_samples(X_scaled)

        # Normalize: sklearn returns negative scores; more negative = more anomalous.
        # Map to [0, 1] where 1 = most anomalous.
        min_s, max_s = raw_scores.min(), raw_scores.max()
        if max_s == min_s:
            return np.zeros(len(raw_scores))
        normalized = 1.0 - (raw_scores - min_s) / (max_s - min_s)
        return normalized
