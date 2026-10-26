import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const waterLog = pgTable("water_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  amount: integer("amount").notNull(),
});

export const mealLog = pgTable("meal_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  type: text("type").notNull(),
});

export const supplementLog = pgTable("supplement_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  name: text("name").notNull(),
  dosage: text("dosage").notNull(),
});

export const migraineLog = pgTable("migraine_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  severity: integer("severity").notNull(),
  duration: integer("duration").notNull(),
  symptoms: text("symptoms").array().notNull(),
  triggers: text("triggers"),
  notes: text("notes"),
  medications: text("medications"),
});

export const cycleLog = pgTable("cycle_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  cycleLength: integer("cycle_length"),
});

export const healthMetrics = pgTable("health_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  readiness: integer("readiness").notNull(),
  sleep: integer("sleep").notNull(),
  stress: integer("stress").notNull(),
  sleepEfficiency: integer("sleep_efficiency"),
  sleepWasoMinutes: integer("sleep_waso_minutes"),
  hrvRmssd: integer("hrv_rmssd"),
  hrvLfHfRatio: integer("hrv_lf_hf_ratio"),
});

export const userProfile = pgTable("user_profile", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().default("default_user").unique(),
  age: integer("age"),
  sex: text("sex"),
  contraceptiveUse: text("contraceptive_use"),
});

export const migrainePredictions = pgTable("migraine_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  predictionHorizon: integer("prediction_horizon").notNull(),
  probability: real("probability").notNull(),
  featureImportance: text("feature_importance"),
  sourceSnapshot: text("source_snapshot"),
});

export const lifestyleLog = pgTable("lifestyle_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  caffeineIntake: integer("caffeine_intake"),
  alcoholIntake: integer("alcohol_intake"),
  perceivedStress: integer("perceived_stress"),
});

export const insertWaterLogSchema = createInsertSchema(waterLog).omit({ id: true, timestamp: true });
export const insertMealLogSchema = createInsertSchema(mealLog).omit({ id: true, timestamp: true });
export const insertSupplementLogSchema = createInsertSchema(supplementLog).omit({ id: true, timestamp: true });
export const insertMigraineLogSchema = createInsertSchema(migraineLog).omit({ id: true, timestamp: true });
export const insertCycleLogSchema = createInsertSchema(cycleLog).omit({ id: true });
export const insertHealthMetricsSchema = createInsertSchema(healthMetrics).omit({ id: true });
export const insertUserProfileSchema = createInsertSchema(userProfile).omit({ id: true, userId: true });
export const insertLifestyleLogSchema = createInsertSchema(lifestyleLog).omit({ id: true, timestamp: true });
export const insertMigrainePredictionSchema = createInsertSchema(migrainePredictions).omit({ id: true, timestamp: true });

export type InsertWaterLog = z.infer<typeof insertWaterLogSchema>;
export type WaterLog = typeof waterLog.$inferSelect;
export type InsertMealLog = z.infer<typeof insertMealLogSchema>;
export type MealLog = typeof mealLog.$inferSelect;
export type InsertSupplementLog = z.infer<typeof insertSupplementLogSchema>;
export type SupplementLog = typeof supplementLog.$inferSelect;
export type InsertMigraineLog = z.infer<typeof insertMigraineLogSchema>;
export type MigraineLog = typeof migraineLog.$inferSelect;
export type InsertCycleLog = z.infer<typeof insertCycleLogSchema>;
export type CycleLog = typeof cycleLog.$inferSelect;
export type InsertHealthMetrics = z.infer<typeof insertHealthMetricsSchema>;
export type HealthMetrics = typeof healthMetrics.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfile.$inferSelect;
export type InsertLifestyleLog = z.infer<typeof insertLifestyleLogSchema>;
export type LifestyleLog = typeof lifestyleLog.$inferSelect;
export type InsertMigrainePrediction = z.infer<typeof insertMigrainePredictionSchema>;
export type MigrainePrediction = typeof migrainePredictions.$inferSelect;
