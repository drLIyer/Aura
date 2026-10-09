import { TRIGGERS, WARNING_SIGNS, labelOf } from '../domain/catalog';
import { addDays, daysBetween } from '../domain/dates';
import type { AppState, DailyLog, ISODate } from '../domain/types';
import {
  LOOKAHEAD_DAYS,
  PRODROME,
  attackOnsetDates,
  cycleStarts,
  effectiveExposures,
  wearableByDate,
} from './patterns';
import { DEFAULT_PRIOR, SELF_REPORT_RR, TRIGGER_PRIORS } from './priors';

/**
 * Personal attack-risk model.
 *
 * Each trigger's effect is a log relative risk built in three layers:
 *   1. research prior (priors.ts),
 *   2. shifted by what the patient reported at intake,
 *   3. updated with the patient's own check-ins and attacks (normal–normal Bayesian update
 *      of the log relative risk, weighted by precision).
 * Early on the forecast reflects research and the patient's beliefs. As logs accumulate,
 * personal data dominates and triggers that don't hold up for this patient fade out.
 *
 * Risk is the chance of an attack starting today or tomorrow, from a logistic model whose
 * intercept is the patient's base rate and whose terms are centred on how often each
 * exposure normally occurs. A typical day therefore forecasts the base rate.
 */

const PRIOR_SD = 0.35;
const SELF_REPORT_WEIGHT = 0.5;
/** Pseudo-days given to the intake estimate of attack frequency. */
const BASE_RATE_PSEUDO_DAYS = 14;

export interface TriggerWeight {
  id: string;
  label: string;
  researchRR: number;
  selfReportedRR?: number;
  /** Prior after combining research and self-report. */
  priorRR: number;
  dataRR?: number;
  exposedDays: number;
  /** Final relative risk used for prediction. */
  rr: number;
  /** 95% credible interval on the relative risk. */
  rrLow: number;
  rrHigh: number;
  /** Share of the final estimate that comes from the patient's own data (0–1). */
  personalWeight: number;
  /** Fraction of logged days with this exposure, used for centring. */
  usualFrequency: number;
}

export interface RiskModel {
  baseRate: number;
  loggedDays: number;
  weights: Map<string, TriggerWeight>;
}

export function triggerLabel(state: Pick<AppState, 'patterns'>, id: string): string {
  if (id === PRODROME) return 'Early warning signs';
  return state.patterns.customTriggers.find((c) => c.id === id)?.label ?? labelOf(TRIGGERS, id);
}

const logit = (p: number) => Math.log(p / (1 - p));
const expit = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (p: number) => Math.min(0.98, Math.max(0.01, p));

/** Chance of ≥1 attack onset in a (1 + LOOKAHEAD_DAYS)-day window from a monthly attack-day count. */
function windowRiskFromMonthly(daysPerMonth: number): number {
  const daily = Math.min(daysPerMonth, 29) / 30;
  return 1 - (1 - daily) ** (1 + LOOKAHEAD_DAYS);
}

/** Fits the model using check-ins dated strictly before `before` (or all, if omitted). */
export function fitRiskModel(state: AppState, before?: ISODate): RiskModel {
  const logs = before ? state.dailyLogs.filter((l) => l.date < before) : state.dailyLogs;
  // Outcomes after `before` must not leak into the fit.
  const onsets = new Set([...attackOnsetDates(state)].filter((d) => !before || d < before));
  const wearable = {
    sleep: wearableByDate(state, 'sleepMinutes'),
    sleepScore: wearableByDate(state, 'sleepScore'),
    readiness: wearableByDate(state, 'readinessScore'),
  };
  const days = logs
    // A day's outcome window must be fully observed.
    .filter((l) => !before || addDays(l.date, LOOKAHEAD_DAYS) < before)
    .map((l) => {
      let attack = false;
      for (let i = 0; i <= LOOKAHEAD_DAYS; i++) if (onsets.has(addDays(l.date, i))) attack = true;
      return {
        attack,
        exposures: effectiveExposures(l, {
          sleepMinutes: wearable.sleep.get(l.date),
          sleepScore: wearable.sleepScore.get(l.date),
          readinessScore: wearable.readiness.get(l.date),
        }),
      };
    });

  const n = days.length;
  const attacks = days.filter((d) => d.attack).length;
  const typical = state.patterns.typicalMigraineDaysPerMonth;
  const priorBase = windowRiskFromMonthly(typical ?? 4);
  const baseRate = clamp((attacks + priorBase * BASE_RATE_PSEUDO_DAYS) / (n + BASE_RATE_PSEUDO_DAYS));

  const ids = new Set<string>([
    ...Object.keys(TRIGGER_PRIORS),
    ...state.patterns.triggers.map((t) => t.id),
    ...days.flatMap((d) => [...d.exposures]),
  ]);
  const beliefs = new Map(state.patterns.triggers.map((t) => [t.id, t]));
  const intakeDone = Boolean(state.patterns.completedAt);

  const weights = new Map<string, TriggerWeight>();
  for (const id of ids) {
    const research = TRIGGER_PRIORS[id] ?? DEFAULT_PRIOR;
    let mu0 = Math.log(research.rr);
    const belief = beliefs.get(id);
    const selfRR = belief ? SELF_REPORT_RR[belief.likelihood] : undefined;
    if (selfRR !== undefined && belief!.likelihood !== 'unsure') {
      mu0 = (1 - SELF_REPORT_WEIGHT) * mu0 + SELF_REPORT_WEIGHT * Math.log(selfRR);
    } else if (intakeDone && !belief && id !== PRODROME) {
      // The patient went through the trigger list and did not pick this one.
      mu0 *= 0.5;
    }

    const exposed = days.filter((d) => d.exposures.has(id));
    const unexposed = n - exposed.length;
    let mu = mu0;
    let sd = PRIOR_SD;
    let dataRR: number | undefined;
    let personalWeight = 0;
    if (exposed.length >= 2 && unexposed >= 2) {
      const a = exposed.filter((d) => d.attack).length + 0.5;
      const n1 = exposed.length + 1;
      const c = attacks - (a - 0.5) + 0.5;
      const n0 = unexposed + 1;
      const x = Math.log(a / n1 / (c / n0));
      const se2 = 1 / a - 1 / n1 + 1 / c - 1 / n0;
      const p0 = 1 / PRIOR_SD ** 2;
      const p1 = 1 / se2;
      mu = (mu0 * p0 + x * p1) / (p0 + p1);
      sd = Math.sqrt(1 / (p0 + p1));
      dataRR = Math.exp(x);
      personalWeight = p1 / (p0 + p1);
    }
    weights.set(id, {
      id,
      label: triggerLabel(state, id),
      researchRR: research.rr,
      selfReportedRR: selfRR,
      priorRR: Math.exp(mu0),
      dataRR,
      exposedDays: exposed.length,
      rr: Math.exp(mu),
      rrLow: Math.exp(mu - 1.96 * sd),
      rrHigh: Math.exp(mu + 1.96 * sd),
      personalWeight,
      usualFrequency: n >= 7 ? exposed.length / n : 0.05,
    });
  }
  return { baseRate, loggedDays: n, weights };
}

export interface Contributor {
  id: string;
  label: string;
  rr: number;
  /** Where the exposure came from. */
  via: 'check-in' | 'wearable' | 'cycle forecast' | 'warning signs';
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'very-high';

export interface Forecast {
  date: ISODate;
  probability: number;
  baseRate: number;
  level: RiskLevel;
  contributors: Contributor[];
  /** Inputs that would improve the forecast if provided. */
  missing: string[];
  loggedDays: number;
}

export function riskLevel(p: number, base: number): RiskLevel {
  const ratio = p / base;
  if (p >= 0.6 || ratio >= 2.5) return 'very-high';
  if (ratio >= 1.5) return 'high';
  if (ratio >= 0.8) return 'moderate';
  return 'low';
}

/** Predicts day 1 of the next period from previously logged cycles. */
export function predictedPeriodStart(state: Pick<AppState, 'dailyLogs'>, today: ISODate): ISODate | undefined {
  const starts = cycleStarts(state.dailyLogs);
  if (starts.length < 2) return undefined;
  const gaps = starts.slice(1).map((s, i) => daysBetween(starts[i], s)).filter((g) => g >= 20 && g <= 45);
  if (!gaps.length) return undefined;
  const cycle = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  let next = addDays(starts[starts.length - 1], cycle);
  while (daysBetween(today, next) < -3) next = addDays(next, cycle);
  return next;
}

export function predictFromExposures(model: RiskModel, exposures: Map<string, Contributor['via']>): { p: number; contributors: Contributor[] } {
  let x = logit(model.baseRate);
  for (const w of model.weights.values()) x -= Math.log(w.rr) * w.usualFrequency;
  const contributors: Contributor[] = [];
  for (const [id, via] of exposures) {
    const w = model.weights.get(id);
    if (!w) continue;
    x += Math.log(w.rr);
    contributors.push({ id, label: w.label, rr: w.rr, via });
  }
  contributors.sort((a, b) => b.rr - a.rr);
  return { p: clamp(expit(x)), contributors };
}

/** Exposures for a day: the check-in (if any), wearable readings and the period forecast. */
export function exposuresForDay(state: AppState, date: ISODate, log?: DailyLog): Map<string, Contributor['via']> {
  const out = new Map<string, Contributor['via']>();
  const wearable = {
    sleepMinutes: wearableByDate(state, 'sleepMinutes').get(date),
    sleepScore: wearableByDate(state, 'sleepScore').get(date),
    readinessScore: wearableByDate(state, 'readinessScore').get(date),
  };
  const fromWearable = effectiveExposures({ date, exposures: [], headache: false }, wearable);
  for (const id of fromWearable) out.set(id, 'wearable');
  if (log) {
    for (const id of effectiveExposures(log, wearable)) out.set(id, id === PRODROME ? 'warning signs' : out.get(id) ?? 'check-in');
  }
  const period = predictedPeriodStart(state, date);
  if (period && !out.has('menstruation')) {
    const d = daysBetween(period, date);
    if (d >= -2 && d <= 3) out.set('menstruation', 'cycle forecast');
  }
  return out;
}

export function forecast(state: AppState, today: ISODate): Forecast {
  const model = fitRiskModel(state);
  const log = state.dailyLogs.find((l) => l.date === today);
  const { p, contributors } = predictFromExposures(model, exposuresForDay(state, today, log));
  const missing: string[] = [];
  if (!log) missing.push("today's check-in");
  if (!state.patterns.completedAt) missing.push('the intake questionnaire');
  if (!state.wearableSamples.some((s) => s.date >= addDays(today, -1))) missing.push('recent wearable data');
  return {
    date: today,
    probability: p,
    baseRate: model.baseRate,
    level: riskLevel(p, model.baseRate),
    contributors,
    missing,
    loggedDays: model.loggedDays,
  };
}

export interface Backtest {
  days: number;
  /** Mean squared error of the forecasts (lower is better). */
  brier: number;
  /** Brier score of always forecasting the base rate. */
  brierBaseline: number;
  /** Observed attack rate by forecast level. */
  byLevel: { level: RiskLevel; days: number; attackRate: number }[];
}

/**
 * Honest check of forecast accuracy: each past day is forecast using only data from before
 * that day, then compared with what happened.
 */
export function backtest(state: AppState, today: ISODate, horizonDays = 90, minHistory = 14): Backtest | null {
  const onsets = attackOnsetDates(state);
  const logs = [...state.dailyLogs].sort((a, b) => a.date.localeCompare(b.date));
  const results: { p: number; base: number; level: RiskLevel; y: number }[] = [];
  for (const log of logs) {
    if (log.date < addDays(today, -horizonDays) || addDays(log.date, LOOKAHEAD_DAYS) >= today) continue;
    const model = fitRiskModel(state, log.date);
    if (model.loggedDays < minHistory) continue;
    const { p } = predictFromExposures(model, exposuresForDay(state, log.date, log));
    let y = 0;
    for (let i = 0; i <= LOOKAHEAD_DAYS; i++) if (onsets.has(addDays(log.date, i))) y = 1;
    results.push({ p, base: model.baseRate, level: riskLevel(p, model.baseRate), y });
  }
  if (results.length < 10) return null;
  const mse = (f: (r: (typeof results)[number]) => number) =>
    results.reduce((s, r) => s + (f(r) - r.y) ** 2, 0) / results.length;
  const levels: RiskLevel[] = ['low', 'moderate', 'high', 'very-high'];
  return {
    days: results.length,
    brier: mse((r) => r.p),
    brierBaseline: mse((r) => r.base),
    byLevel: levels
      .map((level) => {
        const rs = results.filter((r) => r.level === level);
        return { level, days: rs.length, attackRate: rs.length ? rs.filter((r) => r.y).length / rs.length : 0 };
      })
      .filter((l) => l.days > 0),
  };
}

export const warningSignLabel = (id: string) => labelOf(WARNING_SIGNS, id);
