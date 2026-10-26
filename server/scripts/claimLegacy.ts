/**
 * One-time migration for data entered before accounts existed.
 *
 *   npm run db:claim-legacy -- <userId> [timeZone]
 *
 * - Assigns water, meal, supplement and period rows with user_id 'legacy' to <userId>,
 *   filling in local dates/times from their timestamps in [timeZone] (default UTC).
 * - Copies the old health_metrics, lifestyle_log and migraine_log tables into the new
 *   check-in, wearable and attack tables for <userId>. The old stress score (higher = calmer)
 *   becomes a stress-management reading, not self-rated stress. The old tables are left untouched.
 *
 * The user id is the "sub" of the Replit account (shown at /api/auth/user once signed in).
 */
import { eq } from "drizzle-orm";
import { attackInput, dailyLogInput } from "@shared/api";
import * as schema from "@shared/schema";
import { db } from "../db";
import { DbStorage } from "../storage";
import { isValidTimeZone, localDate, localDateTime, localTime } from "../time";

/** Old symptom labels → new ids. */
const SYMPTOMS: Record<string, string> = {
  Nausea: "nausea",
  Aura: "aura-visual",
  "Light Sensitivity": "photophobia",
  "Sound Sensitivity": "phonophobia",
  Fatigue: "fatigue",
};
const OLD_MEDICATIONS: Record<string, { cls: "nsaid" | "simple-analgesic" }> = {
  "Diclofenac Sodium": { cls: "nsaid" },
  Ibuprofen: { cls: "nsaid" },
  Acetaminophen: { cls: "simple-analgesic" },
};

async function main() {
  const [userId, tzArg] = process.argv.slice(2);
  if (!userId) throw new Error("Usage: npm run db:claim-legacy -- <userId> [timeZone]");
  const tz = tzArg ?? "UTC";
  if (!isValidTimeZone(tz)) throw new Error(`Unknown time zone: ${tz}`);
  const storage = new DbStorage(db);

  // 1. Quick logs: take ownership and fill in local dates.
  for (const row of await db.select().from(schema.waterLog).where(eq(schema.waterLog.userId, "legacy"))) {
    await db.update(schema.waterLog).set({ userId, localDate: row.localDate ?? localDate(row.timestamp, tz) }).where(eq(schema.waterLog.id, row.id));
  }
  for (const row of await db.select().from(schema.mealLog).where(eq(schema.mealLog.userId, "legacy"))) {
    await db
      .update(schema.mealLog)
      .set({ userId, localDate: row.localDate ?? localDate(row.timestamp, tz), localTime: row.localTime ?? localTime(row.timestamp, tz) })
      .where(eq(schema.mealLog.id, row.id));
  }
  for (const row of await db.select().from(schema.supplementLog).where(eq(schema.supplementLog.userId, "legacy"))) {
    await db.update(schema.supplementLog).set({ userId, localDate: row.localDate ?? localDate(row.timestamp, tz) }).where(eq(schema.supplementLog.id, row.id));
  }
  await db.update(schema.cycleLog).set({ userId }).where(eq(schema.cycleLog.userId, "legacy"));
  await storage.saveProfile(userId, { timezone: tz });

  // 2. Old structured tables → new ones (only once).
  if ((await storage.listAttacks(userId)).length || (await storage.listDailyLogs(userId)).length) {
    console.log("This user already has attacks or check-ins; skipping the copy of old migraine and health tables.");
    return;
  }

  const lifestyle = await db.select().from(schema.legacyLifestyleLog);
  const caffeineByDate = new Map(lifestyle.filter((l) => l.caffeineIntake != null).map((l) => [localDate(l.timestamp, tz), l.caffeineIntake!]));
  const legacyScores = [];
  for (const m of await db.select().from(schema.legacyHealthMetrics)) {
    await storage.upsertDailyLog(
      userId,
      m.date,
      dailyLogInput.parse({
        readinessScore: m.readiness,
        sleepScore: m.sleep,
        caffeineMg: caffeineByDate.get(m.date),
        notes: "Imported from the first version of the app",
      }),
    );
    // The old "stress" was a device stress-management score (higher = calmer, e.g. Fitbit's).
    // It is kept as that measure rather than converted into self-rated stress.
    legacyScores.push({ date: m.date, metric: "stressManagementScore", value: m.stress, source: "legacy-import" });
  }
  await storage.upsertWearableSamples(userId, legacyScores);

  const meds = new Map((await storage.listMedications(userId)).map((m) => [m.name, m.id]));
  const medId = async (name: string) => {
    if (!meds.has(name)) {
      const known = OLD_MEDICATIONS[name];
      const created = await storage.createMedication(userId, {
        name,
        cls: known?.cls ?? "other",
        role: "acute",
        schedule: "as-needed",
        overTheCounter: true,
        active: true,
      });
      meds.set(name, created.id);
    }
    return meds.get(name)!;
  };

  for (const m of await db.select().from(schema.legacyMigraineLog)) {
    const start = localDateTime(m.timestamp, tz);
    const end = m.duration > 0 ? localDateTime(new Date(m.timestamp.getTime() + m.duration * 3_600_000), tz) : undefined;
    let oldMeds: { name?: string; dosage?: string }[] = [];
    try {
      oldMeds = m.medications ? JSON.parse(m.medications) : [];
    } catch {
      oldMeds = [];
    }
    const doses = [];
    for (const om of oldMeds) if (om.name) doses.push({ medicationId: await medId(om.name), takenAt: start, dose: om.dosage ? `${om.dosage} mg` : undefined });
    await storage.createAttack(
      userId,
      attackInput.parse({
        start,
        end,
        peakSeverity: Math.min(10, Math.max(0, m.severity)),
        symptoms: m.symptoms.map((s) => SYMPTOMS[s]).filter(Boolean),
        painQualities: m.symptoms.includes("Throbbing Pain") ? ["throbbing"] : [],
        doses,
        notes: [m.triggers && `Triggers (old free text): ${m.triggers}`, m.notes].filter(Boolean).join("\n") || undefined,
      }),
    );
  }

  const [oldProfile] = await db.select().from(schema.legacyUserProfile);
  if (oldProfile) {
    const current = await storage.getProfile(userId);
    const sex = oldProfile.sex === "female" || oldProfile.sex === "male" ? oldProfile.sex : current.profile.sex;
    await storage.saveProfile(userId, {
      profile: { ...current.profile, sex, birthYear: current.profile.birthYear ?? (oldProfile.age ? new Date().getFullYear() - oldProfile.age : undefined) },
    });
  }
  console.log(`Done. Legacy data now belongs to ${userId}.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err.message);
    process.exit(1);
  },
);
