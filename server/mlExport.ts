import { db } from './db';
import { healthMetrics, migraineLog, cycleLog, waterLog, mealLog, lifestyleLog, userProfile } from '@shared/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { format } from 'date-fns';

export interface MLDataRow {
  user_id: string;
  timestamp: string;
  age: number | null;
  sex: string | null;
  contraceptive_use: string | null;
  hours_of_sleep: number | null;
  sleep_efficiency: number | null;
  sleep_waso_minutes: number | null;
  resting_heart_rate: number | null;
  hrv_rmssd: number | null;
  hrv_lf_hf_ratio: number | null;
  perceived_stress_score: number | null;
  caffeine_intake_last_24h: number | null;
  alcohol_intake_24h: number | null;
  menstrual_cycle_day: number | null;
  hours_since_last_meal: number | null;
  time_since_last_migraine_hours: number | null;
  baseline_monthly_frequency: number | null;
  barometric_pressure_change_24h: number | null;
  device_rr_series_quality_flag: boolean;
  migraine_label_next_24h: number;
}

export async function generateMLDataset(): Promise<MLDataRow[]> {
  // Get user profile (if exists)
  const profiles = await db.select().from(userProfile);
  const profile = profiles[0] || { age: null, sex: null, contraceptiveUse: null };

  // Get all health metrics (these have dates)
  const metrics = await db.select().from(healthMetrics).orderBy(desc(healthMetrics.date));
  
  // Get all migraine logs
  const migraines = await db.select().from(migraineLog).orderBy(desc(migraineLog.timestamp));
  
  // Get cycle logs
  const cycles = await db.select().from(cycleLog).orderBy(desc(cycleLog.startDate));
  
  // Get lifestyle logs
  const lifestyle = await db.select().from(lifestyleLog).orderBy(desc(lifestyleLog.timestamp));
  
  // Get meal logs for hours_since_last_meal calculation
  const meals = await db.select().from(mealLog).orderBy(desc(mealLog.timestamp));
  
  const rows: MLDataRow[] = [];
  
  // Build dataset: one row per health metric date
  for (const metric of metrics) {
    const metricDate = new Date(metric.date);
    
    // Find if migraine occurred in next 24 hours
    const nextDay = new Date(metricDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const hasMigraineNext24h = migraines.some(m => {
      const mDate = new Date(m.timestamp);
      return mDate >= metricDate && mDate < nextDay;
    });
    
    // Calculate cycle day
    let cycleDay: number | null = null;
    const activeCycle = cycles.find(c => {
      const start = new Date(c.startDate);
      const end = c.endDate ? new Date(c.endDate) : null;
      return metricDate >= start && (end === null || metricDate <= end);
    });
    
    if (activeCycle) {
      const start = new Date(activeCycle.startDate);
      const diffDays = Math.floor((metricDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      cycleDay = diffDays + 1;
    }
    
    // Find lifestyle data for this date
    const lifestyleForDate = lifestyle.find(l => {
      const lDate = new Date(l.timestamp);
      return lDate.toDateString() === metricDate.toDateString();
    });
    
    // Calculate hours since last meal
    const previousMeals = meals.filter(m => new Date(m.timestamp) < metricDate);
    let hoursSinceLastMeal: number | null = null;
    if (previousMeals.length > 0) {
      const lastMeal = previousMeals[0];
      const mealTime = new Date(lastMeal.timestamp);
      hoursSinceLastMeal = (metricDate.getTime() - mealTime.getTime()) / (1000 * 60 * 60);
    }
    
    // Calculate time since last migraine
    const previousMigraines = migraines.filter(m => new Date(m.timestamp) < metricDate);
    let timeSinceLastMigraine: number | null = null;
    if (previousMigraines.length > 0) {
      const lastMigraine = previousMigraines[0];
      const migraineTime = new Date(lastMigraine.timestamp);
      timeSinceLastMigraine = (metricDate.getTime() - migraineTime.getTime()) / (1000 * 60 * 60);
    }
    
    // Calculate baseline monthly frequency (migraines in last 30 days)
    const thirtyDaysAgo = new Date(metricDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentMigraines = migraines.filter(m => {
      const mDate = new Date(m.timestamp);
      return mDate >= thirtyDaysAgo && mDate < metricDate;
    });
    const baselineFrequency = recentMigraines.length;
    
    rows.push({
      user_id: 'default_user',
      timestamp: format(metricDate, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      age: profile.age,
      sex: profile.sex,
      contraceptive_use: profile.contraceptiveUse,
      hours_of_sleep: metric.sleep ? metric.sleep / 10 : null, // Convert from score to hours estimate
      sleep_efficiency: metric.sleepEfficiency,
      sleep_waso_minutes: metric.sleepWasoMinutes,
      resting_heart_rate: null, // TODO: Extract from Fitbit data
      hrv_rmssd: metric.hrvRmssd,
      hrv_lf_hf_ratio: metric.hrvLfHfRatio,
      perceived_stress_score: lifestyleForDate?.perceivedStress || null,
      caffeine_intake_last_24h: lifestyleForDate?.caffeineIntake || null,
      alcohol_intake_24h: lifestyleForDate?.alcoholIntake || null,
      menstrual_cycle_day: cycleDay,
      hours_since_last_meal: hoursSinceLastMeal,
      time_since_last_migraine_hours: timeSinceLastMigraine,
      baseline_monthly_frequency: baselineFrequency,
      barometric_pressure_change_24h: null, // TODO: Integrate weather API
      device_rr_series_quality_flag: true, // Assume good quality for Fitbit data
      migraine_label_next_24h: hasMigraineNext24h ? 1 : 0,
    });
  }
  
  return rows;
}

export function convertToCSV(data: MLDataRow[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header as keyof MLDataRow];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}
