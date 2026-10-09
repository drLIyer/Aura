/** Calendar date in local time, formatted YYYY-MM-DD. */
export type ISODate = string;
/** Full ISO-8601 timestamp. */
export type ISODateTime = string;

export type ReliefAt2h = 'none' | 'partial' | 'pain-free';
export type Disability = 'none' | 'mild' | 'moderate' | 'severe';

export interface MedicationDose {
  medicationId: string;
  takenAt: ISODateTime;
  dose?: string;
  /** Response two hours after the dose — the standard endpoint in migraine trials. */
  reliefAt2h?: ReliefAt2h;
  /** Pain came back within 48 h after initial relief. */
  recurrence?: boolean;
  sideEffects?: string;
}

export interface Attack {
  id: string;
  start: ISODateTime;
  end?: ISODateTime;
  /** Peak pain on a 0–10 numeric rating scale. */
  peakSeverity: number;
  painLocations: string[];
  painQualities: string[];
  symptoms: string[];
  /** Duration of aura in minutes, if any aura symptoms were present. */
  auraMinutes?: number;
  worsenedByActivity: boolean;
  triggers: string[];
  alleviators: string[];
  exacerbators: string[];
  doses: MedicationDose[];
  disability: Disability;
  /** Red-flag features the patient reported for this headache. */
  redFlags: string[];
  notes?: string;
}

/** One check-in per day. Days without attacks are what make trigger analysis possible. */
export interface DailyLog {
  date: ISODate;
  sleepHours?: number;
  /** 1 (poor) – 5 (excellent). */
  sleepQuality?: number;
  /** 0–10. */
  stress?: number;
  caffeineMg?: number;
  waterLiters?: number;
  /** Time lunch was eaten, HH:MM. Absent with 'skipped-meal' exposure means skipped. */
  lunchTime?: string;
  workHours?: number;
  /** Device scores (0–100), e.g. Oura/Fitbit/Garmin sleep score and readiness/body battery. */
  sleepScore?: number;
  readinessScore?: number;
  /** Binary exposures such as alcohol, skipped meal, menstruation. Ids from catalog TRIGGERS. */
  exposures: string[];
  /** Early warning (prodrome) symptoms noticed today, ids from catalog WARNING_SIGNS. */
  warningSigns?: string[];
  /** Any headache today (migraine or not) — needed for the 15-headache-day chronic threshold. */
  headache: boolean;
  notes?: string;
}

export type MedicationClass =
  | 'triptan'
  | 'ergot'
  | 'gepant'
  | 'ditan'
  | 'nsaid'
  | 'simple-analgesic'
  | 'combination-analgesic'
  | 'opioid'
  | 'antiemetic'
  | 'beta-blocker'
  | 'anticonvulsant'
  | 'tricyclic'
  | 'snri'
  | 'ssri'
  | 'maoi'
  | 'cgrp-mab'
  | 'onabotulinumtoxinA'
  | 'arb-ace'
  | 'calcium-channel-blocker'
  | 'hormonal-contraceptive-combined'
  | 'hormonal-contraceptive-progestin'
  | 'anticoagulant'
  | 'nitrate'
  | 'pde5-inhibitor'
  | 'decongestant'
  | 'other';

export type MedicationRole = 'acute' | 'preventive' | 'other';

/** Any medicine the patient takes, migraine-related or not — interactions often involve the others. */
export interface Medication {
  id: string;
  name: string;
  cls: MedicationClass;
  role: MedicationRole;
  dose?: string;
  frequency?: string;
  /** Taken on a schedule, or only when needed. */
  schedule?: 'regular' | 'as-needed';
  /** What it is taken for, in the patient's words. */
  reason?: string;
  prescriber?: string;
  overTheCounter?: boolean;
  startDate?: ISODate;
  active: boolean;
}

export interface Supplement {
  id: string;
  /** Catalog key (e.g. 'magnesium') or 'other'. */
  kind: string;
  name: string;
  /** Daily dose in mg where applicable — used to compare with evidence-based dosing. */
  dailyMg?: number;
  startDate?: ISODate;
  active: boolean;
}

export type Relative = 'mother' | 'father' | 'sibling' | 'child' | 'grandparent' | 'other';

export interface FamilyHistoryItem {
  /** Id from catalog FAMILY_HISTORY. */
  condition: string;
  relatives: Relative[];
  /** Age at onset where relevant (e.g. early stroke or heart attack). */
  ageAtOnset?: number;
  notes?: string;
}

export type Sex = 'female' | 'male' | 'intersex' | 'unspecified';

export interface PatientProfile {
  name?: string;
  birthYear?: number;
  sex: Sex;
  /** Could the patient become pregnant (relevant to valproate/topiramate and some supplements). */
  childbearingPotential?: boolean;
  pregnant?: boolean;
  /** Ids from catalog CONDITIONS. */
  conditions: string[];
  /** Year migraines began — a new headache pattern after 50 is a red flag. */
  migraineOnsetYear?: number;
  smoking?: 'never' | 'former' | 'current';
  familyHistory: FamilyHistoryItem[];
}

export type TriggerLikelihood = 'unsure' | 'sometimes' | 'often' | 'almost-always';

/** A trigger the patient has noticed, from the intake questionnaire. */
export interface TriggerBelief {
  /** Catalog trigger id, or a custom id created by the patient (prefix "custom:"). */
  id: string;
  likelihood: TriggerLikelihood;
  /** What the patient does to avoid or manage this trigger. */
  strategy?: string;
}

export interface CustomOption {
  id: string;
  label: string;
}

/**
 * The patient's own experience, collected at intake before any data analysis. It seeds the
 * personal risk model and is later compared against what the logs show.
 */
export interface SelfReportedPatterns {
  completedAt?: ISODateTime;
  typicalMigraineDaysPerMonth?: number;
  typicalDurationHours?: number;
  yearsWithMigraine?: number;
  triggers: TriggerBelief[];
  /** Triggers the patient defined that are not in the catalog. */
  customTriggers: CustomOption[];
  alleviators: string[];
  exacerbators: string[];
  /** Early warning signs (prodrome) the patient recognises. */
  warningSigns: string[];
  notes?: string;
}

export type WearableMetric =
  | 'restingHeartRate'
  /** RMSSD (Oura, Whoop, Garmin, Polar, chest straps) and SDNN (Apple Watch) are not interchangeable. */
  | 'hrvRmssd'
  | 'hrvSdnn'
  | 'sleepMinutes'
  /** 0–100 vendor scores (Oura, Fitbit, Garmin, Whoop recovery). */
  | 'sleepScore'
  | 'readinessScore'
  | 'steps'
  | 'spo2'
  | 'skinTempDeviation'
  | 'heartRate';

export interface WearableSample {
  date: ISODate;
  metric: WearableMetric;
  value: number;
  source: string;
  timestamp?: ISODateTime;
}

export interface MidasAssessment {
  date: ISODate;
  /** Answers to MIDAS questions 1–5 (days in the past 3 months). */
  answers: [number, number, number, number, number];
}

export interface AppState {
  version: 1;
  profile: PatientProfile;
  patterns: SelfReportedPatterns;
  medications: Medication[];
  supplements: Supplement[];
  attacks: Attack[];
  dailyLogs: DailyLog[];
  wearableSamples: WearableSample[];
  midas: MidasAssessment[];
}

export type Severity = 'urgent' | 'warning' | 'info' | 'positive';

export interface Recommendation {
  id: string;
  severity: Severity;
  category:
    | 'safety'
    | 'medication-overuse'
    | 'prevention'
    | 'acute-treatment'
    | 'interaction'
    | 'supplement'
    | 'pattern'
    | 'wearable'
    | 'data-quality';
  title: string;
  detail: string;
  /** Ids from the guideline registry (src/domain/guidelines.ts) this recommendation is based on. */
  sources: string[];
  /**
   * Who sees it. Risk-factor detail is for the clinician; the patient sees practical prompts
   * and only true emergencies as urgent. Defaults to both.
   */
  audience?: 'patient' | 'clinician' | 'both';
}
