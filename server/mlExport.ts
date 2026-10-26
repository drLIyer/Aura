import type { AppState } from "@shared/engine/domain/types";
import { addDays, daysBetween } from "@shared/engine/domain/dates";
import { cycleStatus, exposuresByLog, wearableByDate } from "@shared/engine/cds/patterns";

/**
 * Training data for a future model: one row per check-in day D for the signed-in user only.
 * Features describe day D (and before); the label is whether an attack STARTS on day D+1.
 * Rows whose label day hasn't finished yet are left out, so no row peeks at the future.
 */
export interface MLDataRow {
  date: string;
  age: number | null;
  sex: string;
  sleep_hours: number | null;
  sleep_score: number | null;
  readiness_score: number | null;
  stress_0_10: number | null;
  caffeine_mg: number | null;
  water_liters: number | null;
  work_hours: number | null;
  lunch_time_minutes: number | null;
  resting_heart_rate: number | null;
  hrv_rmssd: number | null;
  wearable_sleep_minutes: number | null;
  cycle_day: number | null;
  cycle_length: number | null;
  in_perimenstrual_window: number;
  days_since_last_migraine: number | null;
  migraine_days_prior_30d: number;
  exposures: string;
  warning_signs: number;
  migraine_onset_next_day: number;
}

export function generateMLDataset(state: AppState, today: string): MLDataRow[] {
  const onsets = new Set(state.attacks.map((a) => a.start.slice(0, 10)));
  const onsetList = [...onsets].sort();
  const rhr = wearableByDate(state, "restingHeartRate");
  const hrv = wearableByDate(state, "hrvRmssd");
  const sleepMin = wearableByDate(state, "sleepMinutes");
  const byLog = exposuresByLog(state);
  const birthYear = state.profile.birthYear;

  const rows: MLDataRow[] = [];
  for (const log of state.dailyLogs) {
    const labelDay = addDays(log.date, 1);
    if (labelDay >= today) continue;
    // Only periods known by day D shape day D's cycle features.
    const cycle = cycleStatus({ dailyLogs: [], periods: state.periods.filter((p) => p.start <= log.date) }, log.date);
    const prior = onsetList.filter((d) => d <= log.date);
    const last = prior[prior.length - 1];
    const from30 = addDays(log.date, -29);
    rows.push({
      date: log.date,
      age: birthYear ? Number(log.date.slice(0, 4)) - birthYear : null,
      sex: state.profile.sex,
      sleep_hours: log.sleepHours ?? null,
      sleep_score: log.sleepScore ?? null,
      readiness_score: log.readinessScore ?? null,
      stress_0_10: log.stress ?? null,
      caffeine_mg: log.caffeineMg ?? null,
      water_liters: log.waterLiters ?? null,
      work_hours: log.workHours ?? null,
      lunch_time_minutes: log.lunchTime ? Number(log.lunchTime.slice(0, 2)) * 60 + Number(log.lunchTime.slice(3, 5)) : null,
      resting_heart_rate: rhr.get(log.date) ?? null,
      hrv_rmssd: hrv.get(log.date) ?? null,
      wearable_sleep_minutes: sleepMin.get(log.date) ?? null,
      cycle_day: cycle?.cycleDay ?? null,
      cycle_length: cycle?.averageLength ?? null,
      in_perimenstrual_window: byLog.get(log.date)?.has("menstruation") ? 1 : 0,
      days_since_last_migraine: last ? daysBetween(last, log.date) : null,
      migraine_days_prior_30d: prior.filter((d) => d >= from30).length,
      exposures: [...(byLog.get(log.date) ?? [])].sort().join(";"),
      warning_signs: log.warningSigns?.length ? 1 : 0,
      migraine_onset_next_day: onsets.has(labelDay) ? 1 : 0,
    });
  }
  return rows;
}

export function convertToCSV(rows: MLDataRow[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]) as (keyof MLDataRow)[];
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\n");
}
