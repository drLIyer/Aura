import pandas as pd
import numpy as np

# config
CSV_PATH = "ml/data/input_data.csv"
PREDICTION_WINDOW_HOURS = 24
ROLL_WINDOWS = [3, 7]  # days

# load
df = pd.read_csv(CSV_PATH, parse_dates=["timestamp"])
df = df.sort_values(["user_id", "timestamp"]).reset_index(drop=True)

# ensure timestamp is UTC
df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)

# group operations
def add_rolling_features(g):
    g = g.set_index('timestamp').sort_index()
    # daily-resample if needed (assumes one record per day; otherwise adjust)
    # compute rolling means for numeric fields
    for col in ['hours_of_sleep', 'sleep_efficiency', 'resting_heart_rate', 'hrv_rmssd', 'perceived_stress_score']:
        if col in g.columns:
            for w in ROLL_WINDOWS:
                g[f"{col}_roll_{w}d"] = g[col].rolling(f"{w}D", min_periods=1).mean()
            # delta from 7-day mean
            g[f"{col}_delta_from_7d"] = g[col] - g[f"{col}_roll_7d"]
    # time_since_last_migraine: if missing, large number
    if 'time_since_last_migraine_hours' in g.columns:
        g['time_since_last_migraine_hours'] = g['time_since_last_migraine_hours'].fillna(9999)
    # menstrual features
    if 'menstrual_cycle_day' in g.columns:
        cycle_len = 28.0
        day_norm = (g['menstrual_cycle_day'] % cycle_len) / cycle_len
        g['menstrual_sin'] = np.sin(2 * np.pi * day_norm)
        g['menstrual_cos'] = np.cos(2 * np.pi * day_norm)
        # crude phase one-hot
        def phase(d):
            d = int(d % cycle_len) or 1
            if d <= 5:
                return 'menses'
            elif d <= 12:
                return 'follicular'
            elif d <= 16:
                return 'ovulatory'
            else:
                return 'luteal'
        g['menstrual_phase'] = g['menstrual_cycle_day'].apply(lambda x: phase(x) if not pd.isna(x) else 'unknown')
    # missingness fraction last 7d
    g['missing_data_fraction_last_7d'] = g.isnull().rolling("7D").mean().mean(axis=1).fillna(0)
    return g.reset_index()

df_proc = df.groupby('user_id', group_keys=False).apply(add_rolling_features)

# simple missing handling: create flags and impute
numeric_cols = df_proc.select_dtypes(include=[np.number]).columns.tolist()
for c in numeric_cols:
    df_proc[f"{c}_missing_flag"] = df_proc[c].isnull().astype(int)
    # impute numeric with subject median then global median
    df_proc[c] = df_proc.groupby('user_id')[c].transform(lambda s: s.fillna(s.median()))
    df_proc[c] = df_proc[c].fillna(df_proc[c].median())

# encode categorical: sex, contraceptive_use, menstrual_phase
df_proc = pd.get_dummies(df_proc, columns=['sex','contraceptive_use','menstrual_phase'], dummy_na=True)

# drop columns not used / or keep per schema
# define feature columns (example)
feature_cols = [
    'age',
    'hours_of_sleep','hours_of_sleep_roll_3d','hours_of_sleep_roll_7d','hours_of_sleep_delta_from_7d',
    'sleep_efficiency','sleep_efficiency_roll_3d',
    'resting_heart_rate','resting_heart_rate_roll_3d',
    'hrv_rmssd','hrv_rmssd_roll_3d','hrv_rmssd_delta_from_7d',
    'perceived_stress_score','perceived_stress_score_roll_3d',
    'hours_since_last_meal','caffeine_intake_last_24h','alcohol_intake_24h',
    'time_since_last_migraine_hours','baseline_monthly_frequency',
    'barometric_pressure_change_24h',
    'missing_data_fraction_last_7d',
    'device_rr_series_quality_flag'
]
# include any dummies generated
dummies = [c for c in df_proc.columns if c.startswith('sex_') or c.startswith('contraceptive_use_') or c.startswith('menstrual_phase_')]
feature_cols += dummies

# ensure missing features exist
for c in feature_cols:
    if c not in df_proc.columns:
        df_proc[c] = 0

X = df_proc[feature_cols].astype(float)
y = df_proc['migraine_label_next_24h'].astype(int)

print("Features shape:", X.shape)
print("Label distribution:\n", y.value_counts(dropna=False))

# X, y are now ready for model training/prediction
# Example: persist processed features
X.to_csv("ml/data/X_features_ready.csv", index=False)
y.to_csv("ml/data/y_labels.csv", index=False)

print("\nPreprocessing complete!")
print(f"Features saved to: ml/data/X_features_ready.csv")
print(f"Labels saved to: ml/data/y_labels.csv")
