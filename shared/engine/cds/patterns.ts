import { addDays, daysBetween, toISODate } from '../domain/dates';
import type { AppState, DailyLog, ISODate, WearableMetric } from '../domain/types';
import { deviceMetric } from '../domain/deviceScoring';

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

/**
 * Default thresholds that turn numbers into exposures. Device scores follow vendor bands, where
 * under 70 means "pay attention". Each person can override these with their own (PersonalThresholds).
 */
export const THRESHOLDS = {
  shortSleepHours: 6,
  poorSleepQuality: 2,
  highStress: 7,
  lateLunch: '15:00',
  longWorkHours: 10,
  lowScore: 70,
  /** Garmin-style stress level (higher = more stress): 76+ is Garmin's "high" band. */
  highStressLevel: 76,
  /** Fitbit Stress Management Score (higher = less stress): under 60 means "many signs of stress". */
  lowStressManagement: 60,
};

export interface ResolvedThresholds {
  shortSleepHours: number;
  highStress: number;
  lateLunch: string;
  lowSleepScore: number;
  lowReadiness: number;
}

/**
 * The person's own cut-offs win; otherwise the cut-off of the device that produces the score
 * (e.g. Apple sleep score < 61, WHOOP recovery < 34); otherwise 70.
 */
export function thresholdsFor(state: Pick<AppState, 'patterns'> & Partial<Pick<AppState, 'wearableSamples'>>): ResolvedThresholds {
  const t = state.patterns.thresholds ?? {};
  const deviceDefault = (metric: WearableMetric) =>
    state.wearableSamples ? deviceMetric(primarySource(state as Pick<AppState, 'wearableSamples'>, metric), metric)?.lowBelow : undefined;
  return {
    shortSleepHours: t.shortSleepHours ?? THRESHOLDS.shortSleepHours,
    highStress: t.stressAtLeast ?? THRESHOLDS.highStress,
    lateLunch: t.lateLunchAfter ?? THRESHOLDS.lateLunch,
    lowSleepScore: t.sleepScoreBelow ?? deviceDefault('sleepScore') ?? THRESHOLDS.lowScore,
    lowReadiness: t.readinessBelow ?? deviceDefault('readinessScore') ?? THRESHOLDS.lowScore,
  };
}

/** The source with the most readings for a metric — the device whose scale the person's scores are on. */
export function primarySource(state: Pick<AppState, 'wearableSamples'>, metric: WearableMetric): string | undefined {
  const counts = new Map<string, number>();
  for (const w of state.wearableSamples) if (w.metric === metric) counts.set(w.source, (counts.get(w.source) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

const DEFAULT_RESOLVED: ResolvedThresholds = thresholdsFor({ patterns: { triggers: [], customTriggers: [], alleviators: [], exacerbators: [], warningSigns: [] } });

/** Pseudo-exposure for "early warning signs noticed today". Not a trigger, but a strong short-term predictor. */
export const PRODROME = 'prodrome';

export interface WearableDay {
  sleepMinutes?: number;
  sleepScore?: number;
  readinessScore?: number;
  stressLevel?: number;
  stressManagementScore?: number;
}

/** Exposures recorded explicitly, plus ones implied by the numbers the patient entered or the wearable measured. */
export function effectiveExposures(log: DailyLog, wearable: WearableDay = {}, t: ResolvedThresholds = DEFAULT_RESOLVED): Set<string> {
  const ex = new Set(log.exposures);
  const sleepH = log.sleepHours ?? (wearable.sleepMinutes !== undefined ? wearable.sleepMinutes / 60 : undefined);
  if (sleepH !== undefined && sleepH < t.shortSleepHours) ex.add('poor-sleep');
  if (log.sleepQuality !== undefined && log.sleepQuality <= THRESHOLDS.poorSleepQuality) ex.add('poor-sleep');
  // Self-rated stress wins; otherwise a wearable's stress reading, read in its own direction.
  if (log.stress !== undefined) {
    if (log.stress >= t.highStress) ex.add('stress');
  } else if (wearable.stressLevel !== undefined) {
    if (wearable.stressLevel >= THRESHOLDS.highStressLevel) ex.add('stress');
  } else if (wearable.stressManagementScore !== undefined && wearable.stressManagementScore < THRESHOLDS.lowStressManagement) {
    ex.add('stress');
  }
  if (log.lunchTime && log.lunchTime >= t.lateLunch) ex.add('late-meal');
  if (log.workHours !== undefined && log.workHours >= THRESHOLDS.longWorkHours) ex.add('long-workday');
  const sleepScore = log.sleepScore ?? wearable.sleepScore;
  if (sleepScore !== undefined && sleepScore < t.lowSleepScore) ex.add('low-sleep-score');
  const readiness = log.readinessScore ?? wearable.readinessScore;
  if (readiness !== undefined && readiness < t.lowReadiness) ex.add('low-readiness');
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

/**
 * One value per day for a metric, from the person's main device for that metric only. Different
 * vendors score on different scales (see deviceScoring.ts), so their readings are never averaged together.
 */
export function wearableByDate(state: Pick<AppState, 'wearableSamples'>, metric: WearableMetric): Map<ISODate, number> {
  const source = primarySource(state, metric);
  const sums = new Map<ISODate, { s: number; n: number }>();
  for (const w of state.wearableSamples) {
    if (w.metric !== metric || w.source !== source) continue;
    const e = sums.get(w.date) ?? { s: 0, n: 0 };
    e.s += w.value;
    e.n += 1;
    sums.set(w.date, e);
  }
  return new Map([...sums].map(([d, { s, n }]) => [d, s / n]));
}

type PatternState = Pick<AppState, 'attacks' | 'dailyLogs' | 'wearableSamples' | 'periods'> & Partial<Pick<AppState, 'patterns'>>;

/** Wearable readings for one day, averaged across sources. */
export function wearableDay(state: Pick<AppState, 'wearableSamples'>, date: ISODate): WearableDay {
  const pick = (metric: WearableMetric) => wearableByDate(state, metric).get(date);
  return {
    sleepMinutes: pick('sleepMinutes'),
    sleepScore: pick('sleepScore'),
    readinessScore: pick('readinessScore'),
    stressLevel: pick('stressLevel'),
    stressManagementScore: pick('stressManagementScore'),
  };
}

/** Exposures for every check-in day, including wearable-derived ones and logged periods. */
export function exposuresByLog(state: Omit<PatternState, 'attacks'>): Map<ISODate, Set<string>> {
  const metrics: (keyof WearableDay)[] = ['sleepMinutes', 'sleepScore', 'readinessScore', 'stressLevel', 'stressManagementScore'];
  const series = Object.fromEntries(metrics.map((m) => [m, wearableByDate(state, m as WearableMetric)])) as Record<keyof WearableDay, Map<ISODate, number>>;
  const t = state.patterns ? thresholdsFor({ patterns: state.patterns, wearableSamples: state.wearableSamples }) : DEFAULT_RESOLVED;
  const starts = cycleStarts(state);
  const out = new Map<ISODate, Set<string>>();
  for (const log of state.dailyLogs) {
    const w = Object.fromEntries(metrics.map((m) => [m, series[m].get(log.date)])) as WearableDay;
    const ex = effectiveExposures(log, w, t);
    // "menstruation" as an exposure means the perimenstrual window (day −2 to +3 of a period start),
    // the window where risk is raised (MacGregor 2004; ICHD-3 A1.1), not just bleeding days.
    ex.delete('menstruation');
    if (starts.some((s) => inPerimenstrualWindow(log.date, s))) ex.add('menstruation');
    out.set(log.date, ex);
  }
  return out;
}

export function analyzeTriggers(state: PatternState): TriggerAssociation[] {
  const onsets = attackOnsetDates(state);
  const byLog = exposuresByLog(state);
  const days = state.dailyLogs.map((log) => ({
    exposures: byLog.get(log.date)!,
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
  stressLevel: { label: 'Stress level (wearable, higher = more)', unit: '' },
  stressManagementScore: { label: 'Stress management score (higher = calmer)', unit: '' },
  steps: { label: 'Steps', unit: '' },
  spo2: { label: 'SpO₂', unit: '%' },
  skinTempDeviation: { label: 'Skin temp deviation', unit: '°C' },
  heartRate: { label: 'Heart rate', unit: 'bpm' },
};

/** Compares each numeric measure on the days before attacks with all other days. */
export function compareMetrics(state: PatternState): MetricComparison[] {
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

/** Assumed period length when only a start date was logged. */
export const DEFAULT_PERIOD_DAYS = 5;

/** Every day of bleeding, from logged periods and from check-ins that ticked "menstruation". */
/** Ages at which periods are expected: menarche from about 10, menopause by about 55 (median 51). */
export const MENSTRUATING_AGES = { from: 10, to: 55 } as const;

/**
 * Whether to show cycle tracking: female and of menstruating age. An unknown birth year counts as
 * in range, since the patient said they are female and may simply not have filled it in.
 */
export function tracksMenstrualCycle(profile: { sex?: string; birthYear?: number } | null | undefined, year: number): boolean {
  if (profile?.sex !== 'female') return false;
  if (!profile.birthYear) return true;
  const age = year - profile.birthYear;
  return age >= MENSTRUATING_AGES.from && age <= MENSTRUATING_AGES.to;
}

export function menstruationDays(state: Pick<AppState, 'dailyLogs' | 'periods'>): Set<ISODate> {
  const days = new Set(state.dailyLogs.filter((l) => l.exposures.includes('menstruation')).map((l) => l.date));
  for (const p of state.periods ?? []) {
    const end = p.end && p.end >= p.start ? p.end : addDays(p.start, DEFAULT_PERIOD_DAYS - 1);
    // Guard against a bad import producing an endless loop.
    for (let d = p.start, i = 0; d <= end && i < 15; d = addDays(d, 1), i++) days.add(d);
  }
  return days;
}

/** Day 1 of each period: a bleeding day not preceded by one. */
export function cycleStarts(state: Pick<AppState, 'dailyLogs' | 'periods'>): ISODate[] {
  const menses = menstruationDays(state);
  return [...menses].filter((d) => !menses.has(addDays(d, -1))).sort();
}

/** Day −2 to day +3 relative to the first day of a period. */
export function inPerimenstrualWindow(date: ISODate, periodStart: ISODate): boolean {
  const d = daysBetween(periodStart, date);
  return d >= -2 && d <= 3;
}

/** Cycle lengths between consecutive starts, ignoring gaps that look like a missed log. */
export function cycleLengths(starts: ISODate[]): number[] {
  return starts
    .slice(1)
    .map((s, i) => daysBetween(starts[i], s))
    .filter((g) => g >= 20 && g <= 45);
}

/** Fallback when fewer than two cycles have been logged. */
export const DEFAULT_CYCLE_DAYS = 28;

export interface CycleStatus {
  lastStart: ISODate;
  /** 1-based day of the current cycle. */
  cycleDay: number;
  /** Average of this person's logged cycles, or the default when not enough are logged. */
  averageLength: number;
  lengthIsEstimated: boolean;
  nextStart: ISODate;
  daysUntilNext: number;
  /** Today is within day −2 to +3 of the last or the predicted next period. */
  inHigherRiskWindow: boolean;
  phase: 'menstruation' | 'follicular' | 'ovulation' | 'luteal';
  /** Past the predicted start with no new period logged. */
  late: boolean;
}

export function cycleStatus(state: Pick<AppState, 'dailyLogs' | 'periods'>, today: ISODate): CycleStatus | null {
  const starts = cycleStarts(state).filter((s) => s <= today);
  if (!starts.length) return null;
  const lengths = cycleLengths(starts).slice(-6);
  const averageLength = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : DEFAULT_CYCLE_DAYS;
  const lastStart = starts[starts.length - 1];
  const cycleDay = daysBetween(lastStart, today) + 1;
  const nextStart = addDays(lastStart, averageLength);
  const daysUntilNext = daysBetween(today, nextStart);
  const menses = menstruationDays(state);
  // Ovulation is about 14 days before the next period; the luteal phase follows it.
  const ovulationDay = averageLength - 14;
  const phase: CycleStatus['phase'] = menses.has(today)
    ? 'menstruation'
    : cycleDay < ovulationDay - 1
      ? 'follicular'
      : cycleDay <= ovulationDay + 1
        ? 'ovulation'
        : 'luteal';
  return {
    lastStart,
    cycleDay,
    averageLength,
    lengthIsEstimated: lengths.length === 0,
    nextStart,
    daysUntilNext,
    inHigherRiskWindow: inPerimenstrualWindow(today, lastStart) || inPerimenstrualWindow(today, nextStart),
    phase,
    late: daysUntilNext < -3,
  };
}

export function menstrualPattern(state: Pick<AppState, 'attacks' | 'dailyLogs' | 'periods'>): MenstrualPattern | null {
  const starts = cycleStarts(state);
  if (starts.length === 0) return null;
  const onsets = state.attacks.map((a) => toISODate(a.start));
  const inWindow = (onset: ISODate, s: ISODate) => inPerimenstrualWindow(onset, s);
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

export interface ScoreBand {
  label: string;
  from: number;
  /** Exclusive upper bound. */
  to: number;
  days: number;
  daysFollowedByAttack: number;
  attackRate: number;
}

export interface ThresholdSuggestion {
  /** Days with a score below this were followed by more attacks. */
  below: number;
  relativeRisk: number;
  exposedDays: number;
}

/** One value per day for a 0–100 score: the check-in value if entered, else the wearable's. */
function dailyScores(state: PatternState, metric: 'sleepScore' | 'readinessScore'): Map<ISODate, number> {
  const out = wearableByDate(state, metric);
  for (const l of state.dailyLogs) {
    const v = l[metric];
    if (typeof v === 'number') out.set(l.date, v);
  }
  return out;
}

/** How often an attack started the same or next day, by score band. Shows a person's own dose–response. */
export function scoreBands(state: PatternState, metric: 'sleepScore' | 'readinessScore', edges = [0, 50, 60, 70, 80, 101]): ScoreBand[] {
  const onsets = attackOnsetDates(state);
  const scores = dailyScores(state, metric);
  return edges.slice(0, -1).map((from, i) => {
    const to = edges[i + 1];
    const days = [...scores].filter(([, v]) => v >= from && v < to).map(([d]) => d);
    const hit = days.filter((d) => attackFollows(d, onsets)).length;
    return {
      label: i === 0 ? `under ${to}` : to > 100 ? `${from}+` : `${from}–${to - 1}`,
      from,
      to,
      days: days.length,
      daysFollowedByAttack: hit,
      attackRate: days.length ? hit / days.length : 0,
    };
  });
}

/**
 * Finds the cut-off below which this person's attacks become clearly more likely: the threshold
 * with the highest relative risk whose 95% CI excludes 1, with at least 5 days on each side.
 */
export function suggestThreshold(state: PatternState, metric: 'sleepScore' | 'readinessScore'): ThresholdSuggestion | null {
  const onsets = attackOnsetDates(state);
  const scores = [...dailyScores(state, metric)];
  let best: ThresholdSuggestion | null = null;
  for (let below = 40; below <= 80; below += 5) {
    const exposed = scores.filter(([, v]) => v < below);
    const other = scores.filter(([, v]) => v >= below);
    if (exposed.length < 5 || other.length < 5) continue;
    const a = exposed.filter(([d]) => attackFollows(d, onsets)).length;
    const c = other.filter(([d]) => attackFollows(d, onsets)).length;
    const { rr, lo } = relativeRisk(a, exposed.length, c, other.length);
    if (lo > 1 && (!best || rr > best.relativeRisk)) best = { below, relativeRisk: rr, exposedDays: exposed.length };
  }
  return best;
}
