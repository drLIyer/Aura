import { z } from "zod";

/**
 * Request validation shared by server (enforcement) and client (types). Every write to the
 * API is parsed with one of these schemas; anything else is rejected with 400.
 */

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
/** Local wall-clock time in the user's time zone, without an offset. */
export const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "Expected YYYY-MM-DDTHH:MM");
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM");
const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(4000);
const id = z.string().trim().min(1).max(80);
const ids = z.array(id).max(60);

export const MEDICATION_CLASSES = [
  "triptan", "ergot", "gepant", "ditan", "nsaid", "simple-analgesic", "combination-analgesic", "opioid",
  "antiemetic", "beta-blocker", "anticonvulsant", "tricyclic", "snri", "ssri", "maoi", "cgrp-mab",
  "onabotulinumtoxinA", "arb-ace", "calcium-channel-blocker", "hormonal-contraceptive-combined",
  "hormonal-contraceptive-progestin", "anticoagulant", "nitrate", "pde5-inhibitor", "decongestant", "other",
] as const;

export const medicationInput = z.object({
  name: z.string().trim().min(1).max(120),
  cls: z.enum(MEDICATION_CLASSES),
  role: z.enum(["acute", "preventive", "other"]),
  dose: shortText.optional(),
  frequency: shortText.optional(),
  schedule: z.enum(["regular", "as-needed"]).optional(),
  reason: shortText.optional(),
  prescriber: shortText.optional(),
  overTheCounter: z.boolean().default(false),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  active: z.boolean().default(true),
});
export type MedicationInput = z.infer<typeof medicationInput>;

export const supplementInput = z.object({
  kind: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  dailyMg: z.number().positive().max(100000).optional(),
  startDate: isoDate.optional(),
  active: z.boolean().default(true),
});
export type SupplementInput = z.infer<typeof supplementInput>;

export const doseInput = z.object({
  medicationId: id,
  takenAt: localDateTime,
  dose: shortText.optional(),
  reliefAt2h: z.enum(["none", "partial", "pain-free"]).optional(),
  recurrence: z.boolean().optional(),
  sideEffects: shortText.optional(),
});

export const attackInput = z
  .object({
    start: localDateTime,
    end: localDateTime.optional(),
    peakSeverity: z.number().int().min(0).max(10),
    painLocations: ids.default([]),
    painQualities: ids.default([]),
    symptoms: ids.default([]),
    auraMinutes: z.number().int().min(0).max(24 * 60).optional(),
    /** Answers to the aura questions (gradual vs sudden, positive vs negative, usual or not). */
    auraOnset: z.enum(["gradual", "sudden", "unsure"]).optional(),
    auraSpread: z.boolean().optional(),
    auraUsual: z.boolean().optional(),
    worsenedByActivity: z.boolean().default(false),
    triggers: ids.default([]),
    alleviators: ids.default([]),
    exacerbators: ids.default([]),
    doses: z.array(doseInput).max(20).default([]),
    disability: z.enum(["none", "mild", "moderate", "severe"]).default("mild"),
    redFlags: ids.default([]),
    notes: longText.optional(),
  })
  .refine((a) => !a.end || a.end >= a.start, { message: "End must be after start", path: ["end"] });
export type AttackInput = z.infer<typeof attackInput>;

const score100 = z.number().int().min(0).max(100);

export const dailyLogInput = z.object({
  sleepHours: z.number().min(0).max(24).optional(),
  sleepQuality: z.number().int().min(1).max(5).optional(),
  /** 0 = no stress, 10 = extreme stress. Higher always means more stress. */
  stress: z.number().int().min(0).max(10).optional(),
  caffeineMg: z.number().min(0).max(3000).optional(),
  waterLiters: z.number().min(0).max(15).optional(),
  lunchTime: hhmm.optional(),
  workHours: z.number().min(0).max(24).optional(),
  sleepScore: score100.optional(),
  readinessScore: score100.optional(),
  exposures: ids.default([]),
  warningSigns: ids.default([]),
  headache: z.boolean().default(false),
  notes: longText.optional(),
});
export type DailyLogInput = z.infer<typeof dailyLogInput>;

export const familyHistoryItem = z.object({
  condition: id,
  relatives: z.array(z.enum(["mother", "father", "sibling", "child", "grandparent", "other"])).max(6),
  ageAtOnset: z.number().int().min(0).max(120).optional(),
  notes: shortText.optional(),
});

export const profileInput = z.object({
  name: shortText.optional(),
  birthYear: z.number().int().min(1900).max(2100).optional(),
  sex: z.enum(["female", "male", "intersex", "unspecified"]).default("unspecified"),
  childbearingPotential: z.boolean().optional(),
  pregnant: z.boolean().optional(),
  conditions: ids.default([]),
  migraineOnsetYear: z.number().int().min(1900).max(2100).optional(),
  smoking: z.enum(["never", "former", "current"]).optional(),
  familyHistory: z.array(familyHistoryItem).max(30).default([]),
});
export type ProfileInput = z.infer<typeof profileInput>;

export const patternsInput = z.object({
  completedAt: z.string().max(40).optional(),
  typicalMigraineDaysPerMonth: z.number().min(0).max(31).optional(),
  typicalDurationHours: z.number().min(0).max(240).optional(),
  yearsWithMigraine: z.number().min(0).max(100).optional(),
  triggers: z
    .array(
      z.object({
        id,
        likelihood: z.enum(["unsure", "sometimes", "often", "almost-always"]),
        strategy: shortText.optional(),
      }),
    )
    .max(80)
    .default([]),
  customTriggers: z.array(z.object({ id: z.string().regex(/^custom:[a-z0-9-]{1,40}$/), label: z.string().trim().min(1).max(60) })).max(30).default([]),
  alleviators: ids.default([]),
  exacerbators: ids.default([]),
  warningSigns: ids.default([]),
  thresholds: z
    .object({
      sleepScoreBelow: z.number().int().min(1).max(100).optional(),
      readinessBelow: z.number().int().min(1).max(100).optional(),
      stressAtLeast: z.number().int().min(1).max(10).optional(),
      lateLunchAfter: hhmm.optional(),
      shortSleepHours: z.number().min(1).max(12).optional(),
    })
    .optional(),
  notes: longText.optional(),
});
export type PatternsInput = z.infer<typeof patternsInput>;

export const profileUpdate = z.object({
  profile: profileInput.optional(),
  patterns: patternsInput.optional(),
  timezone: z.string().max(64).optional(),
});

export const waterInput = z.object({ amount: z.number().int().min(1).max(5000), localDate: isoDate, localTime: hhmm.optional() });
export const mealInput = z.object({ type: z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]), localDate: isoDate, localTime: hhmm });
export const supplementIntakeInput = z.object({ name: z.string().trim().min(1).max(120), dosage: shortText, localDate: isoDate });

export const periodInput = z
  .object({ startDate: isoDate, endDate: isoDate.optional() })
  .refine((p) => !p.endDate || p.endDate >= p.startDate, { message: "End date must be on or after the start date", path: ["endDate"] });
export const periodImport = z.object({ entries: z.array(periodInput).min(1).max(500) });

export const midasInput = z.object({
  date: isoDate,
  answers: z.tuple([z.number().int().min(0).max(92), z.number().int().min(0).max(92), z.number().int().min(0).max(92), z.number().int().min(0).max(92), z.number().int().min(0).max(92)]),
});

export const WEARABLE_METRICS = [
  "restingHeartRate", "hrvRmssd", "hrvSdnn", "sleepMinutes", "sleepScore", "readinessScore", "stressLevel", "stressManagementScore", "steps", "spo2", "skinTempDeviation", "heartRate",
] as const;

export const wearableImport = z.object({
  source: z.string().trim().min(1).max(60),
  samples: z
    .array(z.object({ date: isoDate, metric: z.enum(WEARABLE_METRICS), value: z.number().finite() }))
    .min(1)
    .max(20000),
});

/** Query: a local calendar date chosen by the client (defaults to the user's today). */
export const dateQuery = z.object({ date: isoDate.optional() });
