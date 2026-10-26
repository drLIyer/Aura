# Migraine Prediction Model

This directory contains the machine learning pipeline for predicting migraine attacks 24 hours in advance.

## Setup

Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Usage

1. Export your data from the app (use the Analytics page)
2. Run preprocessing:
```bash
python ml/preprocess.py
```

3. The processed features will be saved to:
   - `ml/data/X_features_ready.csv` - Feature matrix
   - `ml/data/y_labels.csv` - Target labels

## Features

The model uses the following feature categories:

### Sleep Metrics
- Hours of sleep (with 3-day and 7-day rolling averages)
- Sleep efficiency
- Wake after sleep onset (WASO)

### Cardiovascular Metrics
- Resting heart rate
- HRV RMSSD (heart rate variability)
- LF/HF ratio

### Lifestyle Factors
- Hours since last meal
- Caffeine intake (24h)
- Alcohol intake (24h)
- Perceived stress score

### Menstrual Cycle
- Cycle day (sin/cos encoding)
- Phase (one-hot encoded)
- Contraceptive use

### Migraine History
- Time since last migraine
- Baseline monthly frequency

### Environmental
- Barometric pressure changes

### Data Quality
- Device quality flags
- Missing data fraction
