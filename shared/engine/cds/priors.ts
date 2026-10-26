/**
 * Research-based starting weights for the personal risk model.
 *
 * `rr` is a deliberately conservative relative risk of an attack starting on the day of
 * exposure or the next day. Retrospective surveys (e.g. Kelman 2007) show how often people
 * *report* a trigger. Prospective diary studies, which test whether exposure is actually
 * followed by attacks, generally find smaller effects. Self-reported prevalence is
 * therefore shrunk toward 1. Each user's own data overrides these values as it
 * accumulates (see riskModel.ts).
 *
 * `prevalence` is the share of people with migraine reporting the trigger, where a large
 * study gives one. Sources are ids in src/domain/guidelines.ts.
 */
export interface TriggerPrior {
  rr: number;
  prevalence?: number;
  evidence: 'prospective' | 'survey' | 'weak';
  sources: string[];
  note?: string;
}

export const TRIGGER_PRIORS: Record<string, TriggerPrior> = {
  menstruation: { rr: 1.6, prevalence: 0.65, evidence: 'prospective', sources: ['macgregor-2004', 'kelman-2007-triggers'], note: '×1.7 two days before, >×2 on days 1–3 of bleeding.' },
  stress: { rr: 1.15, prevalence: 0.8, evidence: 'prospective', sources: ['holsteen-2020', 'kelman-2007-triggers'], note: 'The most-reported trigger, but stress level itself has a weak effect prospectively.' },
  'stress-letdown': { rr: 1.4, evidence: 'prospective', sources: ['lipton-2014-letdown'], note: 'OR 1.5–1.9 in the 6–18 h after stress falls.' },
  conflict: { rr: 1.05, evidence: 'weak', sources: ['lateef-2024-emotions'], note: 'Anger and negative mood were not significant after adjustment; personal data decides.' },
  'poor-sleep': { rr: 1.25, prevalence: 0.5, evidence: 'prospective', sources: ['kelman-2007-triggers'], note: 'Poor sleep efficiency OR 1.39 next day (Bertisch 2020); short sleep alone was null.' },
  'not-rested': { rr: 1.2, evidence: 'weak', sources: [] },
  'low-sleep-score': { rr: 1.15, evidence: 'weak', sources: [] },
  'low-readiness': { rr: 1.1, evidence: 'weak', sources: [] },
  oversleep: { rr: 1.0, evidence: 'prospective', sources: ['kelman-2007-triggers'] },
  'skipped-meal': { rr: 1.25, prevalence: 0.57, evidence: 'survey', sources: ['kelman-2007-triggers', 'mosek-1995-fasting'], note: 'Long fasts (Ramadan, Yom Kippur) raise risk about 1.6×; no day-level data for single meals.' },
  'late-meal': { rr: 1.2, prevalence: 0.57, evidence: 'survey', sources: ['kelman-2007-triggers'] },
  fasting: { rr: 1.6, evidence: 'prospective', sources: ['mosek-1995-fasting'] },
  'long-workday': { rr: 1.05, evidence: 'weak', sources: [] },
  dehydration: { rr: 1.05, evidence: 'weak', sources: [] },
  alcohol: { rr: 1.0, prevalence: 0.38, evidence: 'prospective', sources: ['vives-mestres-2022-alcohol', 'kelman-2007-triggers'], note: 'Null at 1–4 drinks (OR 1.01); heavy drinking ≥5 drinks about 2×.' },
  'heavy-drinking': { rr: 1.3, evidence: 'prospective', sources: ['vives-mestres-2022-alcohol'] },
  'red-wine': { rr: 1.0, evidence: 'weak', sources: [] },
  'caffeine-excess': { rr: 1.2, evidence: 'prospective', sources: ['mostofsky-2019-caffeine'], note: 'Risk rises at ≥3 servings/day, mostly in infrequent drinkers.' },
  'caffeine-withdrawal': { rr: 1.2, evidence: 'prospective', sources: ['holsteen-2020'] },
  weather: { rr: 1.05, prevalence: 0.53, evidence: 'prospective', sources: ['mukamal-2009-weather', 'kelman-2007-triggers'], note: 'Small at population level; a subgroup is sensitive, which personal data can reveal.' },
  heat: { rr: 1.05, evidence: 'prospective', sources: ['mukamal-2009-weather'] },
  'bright-light': { rr: 1.0, prevalence: 0.38, evidence: 'prospective', sources: ['hougaard-2013-provocation'], note: 'Light provocation did not trigger attacks; light sensitivity is usually a warning sign.' },
  'screen-time': { rr: 1.0, evidence: 'weak', sources: [] },
  'strong-smell': { rr: 1.05, prevalence: 0.44, evidence: 'survey', sources: ['kelman-2007-triggers'] },
  'loud-noise': { rr: 1.0, evidence: 'weak', sources: [] },
  'neck-tension': { rr: 1.0, prevalence: 0.38, evidence: 'weak', sources: ['kelman-2007-triggers'], note: 'Usually a warning sign rather than a cause.' },
  travel: { rr: 1.05, evidence: 'weak', sources: [] },
  'intense-exercise': { rr: 1.05, prevalence: 0.22, evidence: 'prospective', sources: ['hougaard-2013-provocation'] },
  ovulation: { rr: 1.0, evidence: 'weak', sources: [] },
  'aged-cheese': { rr: 1.0, evidence: 'weak', sources: [] },
  chocolate: { rr: 1.0, evidence: 'weak', sources: [], note: 'Craving chocolate is usually a warning sign, not a trigger.' },
  'processed-meat': { rr: 1.0, evidence: 'weak', sources: [] },
  msg: { rr: 1.0, evidence: 'weak', sources: [] },
  aspartame: { rr: 1.0, evidence: 'weak', sources: [] },
  prodrome: { rr: 2.0, evidence: 'prospective', sources: ['giffin-2003-premonitory'], note: '72% of recorded warning symptoms were followed by an attack. Predictor, not a cause.' },
};

/** Default for triggers with no research entry, including the patient's custom triggers. */
export const DEFAULT_PRIOR: TriggerPrior = { rr: 1.05, evidence: 'weak', sources: [] };

/** How a self-reported likelihood shifts the starting relative risk. */
export const SELF_REPORT_RR = {
  unsure: 1.0,
  sometimes: 1.3,
  often: 1.8,
  'almost-always': 2.5,
} as const;
