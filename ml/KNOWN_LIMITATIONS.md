# ML Pipeline - Known Limitations & Setup Requirements

## Critical Timestamp Alignment Issue

**Problem:** The current implementation has a temporal mismatch between data sources:
- **Health Metrics**: Historical Fitbit data from April-May 2016 (940 days)
- **Migraine/Lifestyle Logs**: Real-time data with current timestamps

**Impact:** The ML export will generate labels with all zeros (no migraines) when trained on historical health data, because:
```typescript
// This comparison will fail when metricDate is from 2016 but migraines are logged in 2025
const hasMigraineNext24h = migraines.some(m => {
  const mDate = new Date(m.timestamp);
  return mDate >= metricDate && mDate < nextDay;
});
```

## Solutions

### Option 1: Real-Time Data Collection (Recommended for MVP)
**Best for: New users starting to track migraines**

1. User logs migraines, lifestyle data, and cycle information in real-time
2. Health metrics come from current Fitbit sync (not historical CSV)
3. After 30-90 days of data collection, ML training becomes viable
4. Export generates properly aligned features and labels

**Implementation Status:** ✅ Fully implemented

### Option 2: Historical Data Backfill
**Best for: Users with existing migraine diaries**

1. Manually backfill migraine_log table with historical dates matching Fitbit data
2. Add script to import migraine history from external sources (paper diary, other apps)
3. Requires timestamp translation to align with health_metrics dates

**Implementation Status:** ❌ Not implemented

### Option 3: Separate Historical & Real-Time Pipelines
**Best for: Research using existing datasets**

1. Create dedicated historical dataset loader for Fitbit + migraine history
2. Separate export endpoint: `/api/export/ml-data/historical`
3. Real-time pipeline remains unchanged

**Implementation Status:** ❌ Not implemented

## Current Recommendation

**For MVP launch, use Option 1:**
- Document that ML predictions require 30-90 days of consistent tracking
- Users begin logging migraines, lifestyle, and health data now
- First predictions available after sufficient data accumulation
- This matches real-world usage patterns for health tracking apps

## Data Requirements for ML Training

Minimum viable dataset:
- **Duration**: 30 days (90 days recommended)
- **Health Metrics**: Daily Fitbit sync
- **Migraine Logs**: At least 3-5 migraine episodes
- **Cycle Logs**: At least 1-2 complete menstrual cycles
- **Lifestyle Logs**: Regular caffeine, alcohol, stress tracking

## Testing the Export Pipeline

To test the ML export with current limitations:

```bash
# Export will work but labels will be all zeros
curl http://localhost:5000/api/export/ml-data > test_export.csv

# Check row count
wc -l ml/data/input_data.csv

# Verify columns are present
head -1 ml/data/input_data.csv
```

Expected result: CSV with ~940 rows (one per Fitbit health metric day) but `migraine_label_next_24h` column will be all zeros.

## Future Enhancements

1. **Timestamp normalization utility**: Helper function to align historical data
2. **Data import wizard**: UI for importing migraine history with date pickers
3. **Validation endpoint**: Check dataset quality before training
4. **Auto-scheduling**: Trigger retraining after N days of new data
