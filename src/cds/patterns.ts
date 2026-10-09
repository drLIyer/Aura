import { addDays, daysBetween, toISODate } from '../domain/dates';
import type { AppState, DailyLog, ISODate, WearableMetric } from '../domain/types';

/**
 * Personal pattern analysis. The unit of analysis is a check-in day: an exposure on day D
 * "counts" if an attack starts on D or D+1, because most triggers act within 24–48 h.
 * Without check-ins on attack-free days no risk ratio can be computed, which is why the
 * daily check-in matters as much as the attack log.
 */

export const LOOKAHEAD_DAYS = 1;
const MIN_EXPOSED_DAYS = 3;
const MIN_UNEXPOSED_DAYS = 3;

export function attackOnsetDates(state: Pick<AppState, 'attacks'>): Set<ISODate> {
  return new Set(state.attacks.map((a) => toISODate(a.start)));
}

function attackFollows(day: ISODate, onsets: Set<ISODate>): boolean {
  for (let i = 0; i <= LOOKAHEAD_DAYS; i++) if (onsets.has(addDays(day, i))) return true;
  return false;
}

/** Thresholds that turn numbers into exposures. Scores follow vendor bands, where under 70 means "pay attention". */
export const THRESHOLDS = {
  shortSleepHours: 6,
  poorSleepQuality: 2,
  highStress: 7,
  lateLunch: '15:00',
  longWorkHours: 10,
  lowScore: 70,
};

/** Pseudo-exposure for "early warning signs noticed today". Not a trigger, but a strong short-term predictor. */
export const PRODROME = 'prodrome';

export interface WearableDay {
  sleepMinutes?: number;
  sleepScore?: number;
  readinessScore?: number;
}

/** Exposures recorded explicitly, plus ones implied by the numbers the patient entered or the wearable measured. */
export function effectiveExposures(log: DailyLog, wearable: WearableDay = {}): Set<string> {
  const ex = new Set(log.exposures);
  const sleepH = log.sleepHours ?? (wearable.sleepMinutes !== undefined ? wearable.sleepMinutes / 60 : undefined);
  if (sleepH !== undefined && sleepH < THRESHOLDS.shortSleepHours) ex.add('poor-sleep');
  if (log.sleepQuality !== undefined && log.sleepQuality <= THRESHOLDS.poorSleepQuality) ex.add('poor-sleep');
  if (log.stress !== undefined && log.stress >= THRESHOLDS.highStress) ex.add('stress');
  if (log.lunchTime && log.lunchTime >= THRESHOLDS.lateLunch) ex.add('late-meal');
  if (log.workHours !== undefined && log.workHours >= THRESHOLDS.longWorkHours) ex.add('long-workday');
  const sleepScore = log.sleepScore ?? wearable.sleepScore;
  if (sleepScore !== undefined && sleepScore < THRESHOLDS.lowScore) ex.add('low-sleep-score');
  const readiness = log.readinessScore ?? wearable.readinessScore;
  if (readiness !== undefined && readiness < THRESHOLDS.lowScore) ex.add('low-readiness');
  if (log.warningSigns?.length) ex.add(PRODROME);
  return ex;
}

export interface TriggerAssociation {
  trigger: string;
  exposedDays: number;
  exposedWithAttack: number;
  unexposedDays: number;
  unexposedWithAttack: number;
  /** Risk of an attack within the look-ahead window when exposed ÷ when not exposed. */
  relativeRisk: number;
  ciLow: number;
  ciHigh: number;
  /** Lower bound of the 95% CI is above 1. */
  significant: boolean;
}

/** Relative risk with Haldane correction and a log-normal 95% CI. */
export function relativeRisk(a: number, n1: number, c: number, n0: number): { rr: number; lo: number; hi: number } {
  const a2 = a + 0.5;
  const n12 = n1 + 1;
  const c2 = c + 0.5;
  const n02 = n0 + 1;
  const rr = a2 / n12 / (c2 / n02);
  const se = Math.sqrt(1 / a2 - 1 / n12 + 1 / c2 - 1 / n02);
  return { rr, lo: Math.exp(Math.log(rr) - 1.96 * se), hi: Math.exp(Math.log(rr) + 1.96 * se) };
}

export function wearableByDate(state: Pick<AppState, 'wearableSamples'>, metric: WearableMetric): Map<ISODate, number> {
  const sums = new Map<ISODate, { s: number; n: number }>();
  for (const w of state.wearableSamples) {
    if (w.metric !== metric) continue;
    const e = sums.get(w.date) ?? { s: 0, n: 0 };
    e.s += w.value;
    e.n += 1;
    sums.set(w.date, e);
  }
  return new Map([...sums].map(([d, { s, n }]) => [d, s / n]));
}

export function analyzeTriggers(state: Pick<AppState, 'attacks' | 'dailyLogs' | 'wearableSamples'>): TriggerAssociation[] {
  const onsets = attackOnsetDates(state);
  const sleep = wearableByDate(state, 'sleepMinutes');
  const sleepScore = wearableByDate(state, 'sleepScore');
  const readiness = wearableByDate(state, 'readinessScore');
  const days = state.dailyLogs.map((log) => ({
    exposures: effectiveExposures(log, {
      sleepMinutes: sleep.get(log.date),
      sleepScore: sleepScore.get(log.date),
      readinessScore: readiness.get(log.date),
    }),
    attack: attackFollows(log.date, onsets),
  }));
  const all = new Set(days.flatMap((d) => [...d.exposures]));

  const out: TriggerAssociation[] = [];
  for (const trigger of all) {
    const exposed = days.filter((d) => d.exposures.has(trigger));
    const unexposed = days.filter((d) => !d.exposures.has(trigger));
    if (exposed.length < MIN_EXPOSED_DAYS || unexposed.length < MIN_UNEXPOSED_DAYS) continue;
    const a = exposed.filter((d) => d.attack).length;
    const c = unexposed.filter((d) => d.attack).length;
    const { rr, lo, hi } = relativeRisk(a, exposed.length, c, unexposed.length);
    out.push({
      trigger,
      exposedDays: exposed.length,
      exposedWithAttack: a,
      unexposedDays: unexposed.length,
      unexposedWithAttack: c,
      relativeRisk: rr,
      ciLow: lo,
      ciHigh: hi,
      significant: lo > 1,
    });
  }
  return out.sort((x, y) => y.relativeRisk - x.relativeRisk);
}

export interface MetricComparison {
  metric: string;
  label: string;
  unit: string;
  /** Mean on days followed by an attack within the look-ahead window. */
  preAttackMean: number;
  otherMean: number;
  preAttackDays: number;
  otherDays: number;
  /** Cohen's d (pre-attack minus other). |d| ≥ 0.5 is a medium effect. */
  effectSize: number;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const variance = (xs: number[]) => {
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1);
};

function compare(metric: string, label: string, unit: string, series: Map<ISODate, number>, onsets: Set<ISODate>): MetricComparison | null {
  const pre: number[] = [];
  const other: number[] = [];
  for (const [d, v] of series) (attackFollows(d, onsets) ? pre : other).push(v);
  if (pre.length < 3 || other.length < 5) return null;
  const pooled = Math.sqrt(((pre.length - 1) * variance(pre) + (other.length - 1) * variance(other)) / (pre.length + other.length - 2));
  return {
    metric,
    label,
    unit,
    preAttackMean: mean(pre),
    otherMean: mean(other),
    preAttackDays: pre.length,
    otherDays: other.length,
    effectSize: pooled > 0 ? (mean(pre) - mean(other)) / pooled : 0,
  };
}

const LOG_METRICS: { key: keyof DailyLog; label: string; unit: string }[] = [
  { key: 'sleepHours', label: 'Sleep (check-in)', unit: 'h' },
  { key: 'sleepQuality', label: 'Sleep quality', unit: '/5' },
  { key: 'stress', label: 'Stress', unit: '/10' },
  { key: 'caffeineMg', label: 'Caffeine', unit: 'mg' },
  { key: 'waterLiters', label: 'Water', unit: 'L' },
  { key: 'workHours', label: 'Work hours', unit: 'h' },
  { key: 'sleepScore', label: 'Sleep score (check-in)', unit: '' },
  { key: 'readinessScore', label: 'Readiness score (check-in)', unit: '' },
];

export const WEARABLE_METRIC_INFO: Record<WearableMetric, { label: string; unit: string }> = {
  restingHeartRate: { label: 'Resting heart rate', unit: 'bpm' },
  hrvRmssd: { label: 'HRV (RMSSD)', unit: 'ms' },
  hrvSdnn: { label: 'HRV (SDNN)', unit: 'ms' },
  sleepMinutes: { label: 'Sleep (wearable)', unit: 'min' },
  sleepScore: { label: 'Sleep score (wearable)', unit: '' },
  readinessScore: { label: 'Readiness score (wearable)', unit: '' },
  steps: { label: 'Steps', unit: '' },
  spo2: { label: 'SpO₂', unit: '%' },
  skinTempDeviation: { label: 'Skin temp deviation', unit: '°C' },
  heartRate: { label: 'Heart rate', unit: 'bpm' },
};

/** Compares each numeric measure on the days before attacks with all other days. */
export function compareMetrics(state: Pick<AppState, 'attacks' | 'dailyLogs' | 'wearableSamples'>): MetricComparison[] {
  const onsets = attackOnsetDates(state);
  const out: MetricComparison[] = [];
  for (const { key, label, unit } of LOG_METRICS) {
    const series = new Map<ISODate, number>();
    for (const log of state.dailyLogs) {
      const v = log[key];
      if (typeof v === 'number') series.set(log.date, v);
    }
    const c = compare(key, label, unit, series, onsets);
    if (c) out.push(c);
  }
  for (const metric of Object.keys(WEARABLE_METRIC_INFO) as WearableMetric[]) {
    if (metric === 'heartRate') continue;
    const { label, unit } = WEARABLE_METRIC_INFO[metric];
    const c = compare(metric, label, unit, wearableByDate(state, metric), onsets);
    if (c) out.push(c);
  }
  return out.sort((a, b) => Math.abs(b.effectSize) - Math.abs(a.effectSize));
}

export interface FrequencyItem {
  id: string;
  count: number;
  share: number;
}

/** How often each id appears across attacks (for reported triggers, alleviators, exacerbators). */
export function frequency(state: Pick<AppState, 'attacks'>, field: 'triggers' | 'alleviators' | 'exacerbators'): FrequencyItem[] {
  const counts = new Map<string, number>();
  for (const a of state.attacks) for (const id of a[field]) counts.set(id, (counts.get(id) ?? 0) + 1);
  const n = state.attacks.length || 1;
  return [...counts]
    .map(([id, count]) => ({ id, count, share: count / n }))
    .sort((a, b) => b.count - a.count);
}

export interface MenstrualPattern {
  cycles: number;
  cyclesWithAttack: number;
  /** Share of all attacks that started inside a perimenstrual window. */
  attacksInWindow: number;
  attacksTotal: number;
  /** ICHD-3 A1.1/A1.2: attacks in ≥2 of 3 cycles, from day −2 to day +3 of menstruation. */
  meetsCriteria: boolean;
  /** No attacks outside the perimenstrual windows (pure menstrual migraine). */
  pure: boolean;
}

/** Day 1 of each period: a menstruation day not preceded by one. */
export function cycleStarts(logs: DailyLog[]): ISODate[] {
  const menses = new Set(logs.filter((l) => l.exposures.includes('menstruation')).map((l) => l.date));
  return [...menses].filter((d) => !menses.has(addDays(d, -1))).sort();
}

export function menstrualPattern(state: Pick<AppState, 'attacks' | 'dailyLogs'>): MenstrualPattern | null {
  const starts = cycleStarts(state.dailyLogs);
  if (starts.length === 0) return null;
  const onsets = state.attacks.map((a) => toISODate(a.start));
  const inWindow = (onset: ISODate, s: ISODate) => {
    const d = daysBetween(s, onset);
    return d >= -2 && d <= 3;
  };
  const cyclesWithAttack = starts.filter((s) => onsets.some((o) => inWindow(o, s))).length;
  const first = addDays(starts[0], -2);
  const last = addDays(starts[starts.length - 1], 3);
  const relevant = onsets.filter((o) => o >= first && o <= last);
  const attacksInWindow = relevant.filter((o) => starts.some((s) => inWindow(o, s))).length;
  return {
    cycles: starts.length,
    cyclesWithAttack,
    attacksInWindow,
    attacksTotal: relevant.length,
    meetsCriteria: starts.length >= 3 && cyclesWithAttack / starts.length >= 2 / 3,
    pure: relevant.length > 0 && attacksInWindow === relevant.length,
  };
}
