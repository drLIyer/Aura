"""
Prepares the research CSV (Profile → "Download research CSV", or GET /api/export/ml-data)
for model training.

Each row is one check-in day D for one user. Every feature describes day D or earlier; the label
`migraine_onset_next_day` is whether an attack STARTS on day D+1. Rolling features below only
look backwards, so nothing from the label day leaks into the features.
"""
import numpy as np
import pandas as pd

CSV_PATH = "ml/data/input_data.csv"
ROLL_WINDOWS = [3, 7]  # days
LABEL = "migraine_onset_next_day"

df = pd.read_csv(CSV_PATH, parse_dates=["date"]).sort_values("date").reset_index(drop=True)
df = df.set_index("date")

# Backward-looking rolling means and deviation from the personal 7-day baseline.
for col in ["sleep_hours", "sleep_score", "readiness_score", "resting_heart_rate", "hrv_rmssd", "stress_0_10", "work_hours"]:
    if col in df.columns:
        for w in ROLL_WINDOWS:
            df[f"{col}_roll_{w}d"] = df[col].rolling(f"{w}D", min_periods=1).mean()
        df[f"{col}_delta_from_7d"] = df[col] - df[f"{col}_roll_7d"]

df["days_since_last_migraine"] = df["days_since_last_migraine"].fillna(9999)

# Cycle position, normalised by the person's own learned cycle length (28 only when unknown).
cycle_len = df["cycle_length"].fillna(28.0)
day_norm = (df["cycle_day"] % cycle_len) / cycle_len
df["cycle_sin"] = np.where(df["cycle_day"].notna(), np.sin(2 * np.pi * day_norm), 0.0)
df["cycle_cos"] = np.where(df["cycle_day"].notna(), np.cos(2 * np.pi * day_norm), 0.0)
df["cycle_known"] = df["cycle_day"].notna().astype(int)

# Exposures arrive as "a;b;c": one 0/1 column per exposure.
exposures = df["exposures"].fillna("").str.get_dummies(sep=";").add_prefix("exp_")
df = pd.concat([df, exposures], axis=1)

df["missing_data_fraction_last_7d"] = df.isnull().rolling("7D").mean().mean(axis=1).fillna(0)
df = df.reset_index()

numeric = [c for c in df.select_dtypes(include=[np.number]).columns if c != LABEL]
for c in numeric:
    df[f"{c}_missing_flag"] = df[c].isnull().astype(int)
    df[c] = df[c].fillna(df[c].median())

df = pd.get_dummies(df, columns=["sex"], dummy_na=True)

feature_cols = [c for c in df.columns if c not in {"date", "exposures", LABEL}]
X = df[feature_cols].astype(float)
y = df[LABEL].astype(int)

print("Features shape:", X.shape)
print("Label distribution:\n", y.value_counts(dropna=False))

X.to_csv("ml/data/X_features_ready.csv", index=False)
y.to_csv("ml/data/y_labels.csv", index=False)
print("Saved ml/data/X_features_ready.csv and ml/data/y_labels.csv")
