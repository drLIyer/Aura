import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export * from "./models/auth";

/**
 * Every row of health data belongs to one user. Rows created before accounts existed carry
 * user_id 'legacy' until `npm run db:claim-legacy -- <userId>` assigns them to their owner.
 */
const userId = () => varchar("user_id").notNull().default("legacy");
const id = () => varchar("id").primaryKey().default(sql`gen_random_uuid()`);

// ---------------------------------------------------------------------------------------
// Quick logs (water, meals, supplements taken, periods)

export const waterLog = pgTable(
  "water_log",
  {
    id: id(),
    userId: userId(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    /** The user's calendar date when logged, so "today" never depends on the server's time zone. */
    localDate: date("local_date"),
    amount: integer("amount").notNull(),
  },
  (t) => [index("water_user_date").on(t.userId, t.localDate)],
);

export const mealLog = pgTable(
  "meal_log",
  {
    id: id(),
    userId: userId(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    localDate: date("local_date"),
    /** HH:MM in the user's time zone, used for meal-timing triggers. */
    localTime: varchar("local_time", { length: 5 }),
    type: text("type").notNull(),
  },
  (t) => [index("meal_user_date").on(t.userId, t.localDate)],
);

export const supplementLog = pgTable(
  "supplement_log",
  {
    id: id(),
    userId: userId(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    localDate: date("local_date"),
    name: text("name").notNull(),
    dosage: text("dosage").notNull(),
  },
  (t) => [index("supplement_log_user_date").on(t.userId, t.localDate)],
);

export const cycleLog = pgTable(
  "cycle_log",
  {
    id: id(),
    userId: userId(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    cycleLength: integer("cycle_length"),
  },
  (t) => [index("cycle_user_start").on(t.userId, t.startDate)],
);

// ---------------------------------------------------------------------------------------
// Structured clinical data used by the decision-support engine

/** Health profile (incl. family history) and intake answers, one row per user. */
export const profiles = pgTable("profiles", {
  userId: varchar("user_id").primaryKey(),
  profile: jsonb("profile").notNull(),
  patterns: jsonb("patterns").notNull(),
  /** IANA time zone, e.g. "America/Chicago". */
  timezone: varchar("timezone"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const medications = pgTable(
  "medications",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    cls: varchar("cls").notNull(),
    role: varchar("role").notNull(),
    dose: text("dose"),
    frequency: text("frequency"),
    schedule: varchar("schedule"),
    reason: text("reason"),
    prescriber: text("prescriber"),
    overTheCounter: boolean("over_the_counter").notNull().default(false),
    startDate: date("start_date"),
    endDate: date("end_date"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("medications_user").on(t.userId)],
);

/** Supplements the user takes regularly (the checklist on the dashboard). */
export const supplements = pgTable(
  "supplements",
  {
    id: id(),
    userId: userId(),
    kind: varchar("kind").notNull(),
    name: text("name").notNull(),
    dailyMg: real("daily_mg"),
    startDate: date("start_date"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("supplements_user").on(t.userId)],
);

export const attacks = pgTable(
  "attacks",
  {
    id: id(),
    userId: userId(),
    /** Local wall-clock time "YYYY-MM-DDTHH:MM" in the user's time zone. */
    start: varchar("start", { length: 25 }).notNull(),
    end: varchar("end", { length: 25 }),
    peakSeverity: integer("peak_severity").notNull(),
    /** Symptoms, aura, triggers, doses, red flags… (see AttackInput). */
    details: jsonb("details").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("attacks_user_start").on(t.userId, t.start)],
);

export const dailyLogs = pgTable(
  "daily_logs",
  {
    userId: userId(),
    date: date("date").notNull(),
    data: jsonb("data").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const wearableSamples = pgTable(
  "wearable_samples",
  {
    id: id(),
    userId: userId(),
    date: date("date").notNull(),
    metric: varchar("metric").notNull(),
    value: real("value").notNull(),
    source: varchar("source").notNull(),
  },
  (t) => [uniqueIndex("wearable_unique").on(t.userId, t.date, t.metric, t.source)],
);

export const midasAssessments = pgTable(
  "midas_assessments",
  {
    id: id(),
    userId: userId(),
    date: date("date").notNull(),
    answers: jsonb("answers").notNull(),
  },
  (t) => [index("midas_user").on(t.userId)],
);

/** Links an Aura user to their account on an external gateway such as Open Wearables. */
export const integrations = pgTable(
  "integrations",
  {
    userId: varchar("user_id").notNull(),
    provider: varchar("provider").notNull(),
    externalUserId: varchar("external_user_id").notNull(),
    lastSyncedAt: timestamp("last_synced_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })],
);

// ---------------------------------------------------------------------------------------
// Legacy tables from the first version. Kept (not dropped) so existing data survives;
// `npm run db:claim-legacy` copies them into the tables above.

export const legacyHealthMetrics = pgTable("health_metrics", {
  id: id(),
  date: date("date").notNull(),
  readiness: integer("readiness").notNull(),
  sleep: integer("sleep").notNull(),
  stress: integer("stress").notNull(),
  sleepEfficiency: integer("sleep_efficiency"),
  sleepWasoMinutes: integer("sleep_waso_minutes"),
  hrvRmssd: integer("hrv_rmssd"),
  hrvLfHfRatio: integer("hrv_lf_hf_ratio"),
});

export const legacyMigraineLog = pgTable("migraine_log", {
  id: id(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  severity: integer("severity").notNull(),
  duration: integer("duration").notNull(),
  symptoms: text("symptoms").array().notNull(),
  triggers: text("triggers"),
  notes: text("notes"),
  medications: text("medications"),
});

export const legacyUserProfile = pgTable("user_profile", {
  id: id(),
  userId: varchar("user_id").notNull().default("default_user").unique(),
  age: integer("age"),
  sex: text("sex"),
  contraceptiveUse: text("contraceptive_use"),
});

export const legacyLifestyleLog = pgTable("lifestyle_log", {
  id: id(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  caffeineIntake: integer("caffeine_intake"),
  alcoholIntake: integer("alcohol_intake"),
  perceivedStress: integer("perceived_stress"),
});

export const legacyMigrainePredictions = pgTable("migraine_predictions", {
  id: id(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  predictionHorizon: integer("prediction_horizon").notNull(),
  probability: real("probability").notNull(),
  featureImportance: text("feature_importance"),
  sourceSnapshot: text("source_snapshot"),
});
