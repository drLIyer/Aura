import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import type {
  AttackInput,
  DailyLogInput,
  MedicationInput,
  PatternsInput,
  ProfileInput,
  SupplementInput,
} from "@shared/api";
import * as schema from "@shared/schema";
import { emptyState } from "@shared/engine/state";

/**
 * Persistence. Every method takes the signed-in user's id, and every query filters on it,
 * so one user can never read or change another user's data.
 */

export interface ProfileRecord {
  profile: ProfileInput;
  patterns: PatternsInput;
  timezone: string | null;
}
export interface MedicationRecord extends MedicationInput {
  id: string;
}
export interface SupplementRecord extends SupplementInput {
  id: string;
}
export interface AttackRecord extends AttackInput {
  id: string;
}
export interface DailyLogRecord extends DailyLogInput {
  date: string;
}
export interface WaterRecord {
  id: string;
  timestamp: Date;
  localDate: string | null;
  amount: number;
}
export interface MealRecord {
  id: string;
  timestamp: Date;
  localDate: string | null;
  localTime: string | null;
  type: string;
}
export interface SupplementIntakeRecord {
  id: string;
  timestamp: Date;
  localDate: string | null;
  name: string;
  dosage: string;
}
export interface PeriodRecord {
  id: string;
  startDate: string;
  endDate: string | null;
}
export interface WearableSampleRecord {
  date: string;
  metric: string;
  value: number;
  source: string;
}
export interface MidasRecord {
  id: string;
  date: string;
  answers: [number, number, number, number, number];
}
export interface IntegrationRecord {
  provider: string;
  externalUserId: string;
  lastSyncedAt: Date | null;
}

export interface IStorage {
  getProfile(userId: string): Promise<ProfileRecord>;
  saveProfile(userId: string, update: Partial<ProfileRecord>): Promise<ProfileRecord>;

  listMedications(userId: string): Promise<MedicationRecord[]>;
  createMedication(userId: string, input: MedicationInput): Promise<MedicationRecord>;
  updateMedication(userId: string, id: string, input: MedicationInput): Promise<MedicationRecord | null>;
  deleteMedication(userId: string, id: string): Promise<boolean>;

  listSupplements(userId: string): Promise<SupplementRecord[]>;
  createSupplement(userId: string, input: SupplementInput): Promise<SupplementRecord>;
  updateSupplement(userId: string, id: string, input: SupplementInput): Promise<SupplementRecord | null>;
  deleteSupplement(userId: string, id: string): Promise<boolean>;

  listAttacks(userId: string): Promise<AttackRecord[]>;
  createAttack(userId: string, input: AttackInput): Promise<AttackRecord>;
  updateAttack(userId: string, id: string, input: AttackInput): Promise<AttackRecord | null>;
  deleteAttack(userId: string, id: string): Promise<boolean>;

  listDailyLogs(userId: string, from?: string, to?: string): Promise<DailyLogRecord[]>;
  upsertDailyLog(userId: string, date: string, input: DailyLogInput): Promise<DailyLogRecord>;

  listWater(userId: string, localDate?: string): Promise<WaterRecord[]>;
  addWater(userId: string, amount: number, localDate: string): Promise<WaterRecord>;
  deleteWater(userId: string, id: string): Promise<boolean>;

  listMeals(userId: string, localDate?: string): Promise<MealRecord[]>;
  addMeal(userId: string, type: string, localDate: string, localTime: string): Promise<MealRecord>;
  deleteMeal(userId: string, id: string): Promise<boolean>;

  listSupplementIntake(userId: string, localDate?: string): Promise<SupplementIntakeRecord[]>;
  addSupplementIntake(userId: string, name: string, dosage: string, localDate: string): Promise<SupplementIntakeRecord>;
  deleteSupplementIntake(userId: string, id: string): Promise<boolean>;

  listPeriods(userId: string): Promise<PeriodRecord[]>;
  /** Adds periods, skipping any whose start date is already logged. Returns how many were added. */
  addPeriods(userId: string, entries: { startDate: string; endDate?: string }[]): Promise<number>;
  deletePeriod(userId: string, id: string): Promise<boolean>;

  listWearableSamples(userId: string, from?: string): Promise<WearableSampleRecord[]>;
  upsertWearableSamples(userId: string, samples: WearableSampleRecord[]): Promise<number>;

  listMidas(userId: string): Promise<MidasRecord[]>;
  addMidas(userId: string, date: string, answers: MidasRecord["answers"]): Promise<MidasRecord>;

  getIntegration(userId: string, provider: string): Promise<IntegrationRecord | null>;
  saveIntegration(userId: string, record: IntegrationRecord): Promise<void>;

  /** Permanently deletes every health record for this user. */
  deleteAllUserData(userId: string): Promise<void>;
}

function defaultProfile(): ProfileRecord {
  const s = emptyState();
  return { profile: s.profile as ProfileInput, patterns: s.patterns as PatternsInput, timezone: null };
}

/** Works in Node 19+ and browsers (the demo runs this storage in the page). */
const randomUUID = () => globalThis.crypto.randomUUID();

// ---------------------------------------------------------------------------------------
// In-memory storage: development without a database, and tests.

type Owned<T> = T & { userId: string };

export class MemStorage implements IStorage {
  private profiles = new Map<string, ProfileRecord>();
  private medications: Owned<MedicationRecord>[] = [];
  private supplements: Owned<SupplementRecord>[] = [];
  private attacks: Owned<AttackRecord>[] = [];
  private dailyLogs: Owned<DailyLogRecord>[] = [];
  private water: Owned<WaterRecord>[] = [];
  private meals: Owned<MealRecord>[] = [];
  private supplementIntake: Owned<SupplementIntakeRecord>[] = [];
  private periods: Owned<PeriodRecord>[] = [];
  private samples: Owned<WearableSampleRecord>[] = [];
  private midas: Owned<MidasRecord>[] = [];
  private integrations: Owned<IntegrationRecord>[] = [];

  private mine<T extends { userId: string }>(rows: T[], userId: string) {
    return rows.filter((r) => r.userId === userId);
  }
  private strip<T extends { userId: string }>(row: T): Omit<T, "userId"> {
    const { userId: _u, ...rest } = row;
    return rest;
  }
  private remove<T extends { userId: string; id: string }>(rows: T[], userId: string, id: string): boolean {
    const i = rows.findIndex((r) => r.userId === userId && r.id === id);
    if (i < 0) return false;
    rows.splice(i, 1);
    return true;
  }
  private replace<T extends { userId: string; id: string }>(rows: T[], userId: string, id: string, next: T): T | null {
    const i = rows.findIndex((r) => r.userId === userId && r.id === id);
    if (i < 0) return null;
    rows[i] = next;
    return next;
  }

  async getProfile(userId: string) {
    return this.profiles.get(userId) ?? defaultProfile();
  }
  async saveProfile(userId: string, update: Partial<ProfileRecord>) {
    const next = { ...(await this.getProfile(userId)), ...update };
    this.profiles.set(userId, next);
    return next;
  }

  async listMedications(userId: string) {
    return this.mine(this.medications, userId).map((r) => this.strip(r));
  }
  async createMedication(userId: string, input: MedicationInput) {
    const row = { ...input, id: randomUUID(), userId };
    this.medications.push(row);
    return this.strip(row);
  }
  async updateMedication(userId: string, id: string, input: MedicationInput) {
    const row = this.replace(this.medications, userId, id, { ...input, id, userId });
    return row && this.strip(row);
  }
  async deleteMedication(userId: string, id: string) {
    return this.remove(this.medications, userId, id);
  }

  async listSupplements(userId: string) {
    return this.mine(this.supplements, userId).map((r) => this.strip(r));
  }
  async createSupplement(userId: string, input: SupplementInput) {
    const row = { ...input, id: randomUUID(), userId };
    this.supplements.push(row);
    return this.strip(row);
  }
  async updateSupplement(userId: string, id: string, input: SupplementInput) {
    const row = this.replace(this.supplements, userId, id, { ...input, id, userId });
    return row && this.strip(row);
  }
  async deleteSupplement(userId: string, id: string) {
    return this.remove(this.supplements, userId, id);
  }

  async listAttacks(userId: string) {
    return this.mine(this.attacks, userId)
      .map((r) => this.strip(r))
      .sort((a, b) => b.start.localeCompare(a.start));
  }
  async createAttack(userId: string, input: AttackInput) {
    const row = { ...input, id: randomUUID(), userId };
    this.attacks.push(row);
    return this.strip(row);
  }
  async updateAttack(userId: string, id: string, input: AttackInput) {
    const row = this.replace(this.attacks, userId, id, { ...input, id, userId });
    return row && this.strip(row);
  }
  async deleteAttack(userId: string, id: string) {
    return this.remove(this.attacks, userId, id);
  }

  async listDailyLogs(userId: string, from?: string, to?: string) {
    return this.mine(this.dailyLogs, userId)
      .filter((l) => (!from || l.date >= from) && (!to || l.date <= to))
      .map((r) => this.strip(r))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  async upsertDailyLog(userId: string, date: string, input: DailyLogInput) {
    const row = { ...input, date, userId };
    const i = this.dailyLogs.findIndex((l) => l.userId === userId && l.date === date);
    if (i >= 0) this.dailyLogs[i] = row;
    else this.dailyLogs.push(row);
    return this.strip(row);
  }

  async listWater(userId: string, localDate?: string) {
    return this.mine(this.water, userId)
      .filter((w) => !localDate || w.localDate === localDate)
      .map((r) => this.strip(r));
  }
  async addWater(userId: string, amount: number, localDate: string) {
    const row = { id: randomUUID(), userId, timestamp: new Date(), localDate, amount };
    this.water.push(row);
    return this.strip(row);
  }
  async deleteWater(userId: string, id: string) {
    return this.remove(this.water, userId, id);
  }

  async listMeals(userId: string, localDate?: string) {
    return this.mine(this.meals, userId)
      .filter((m) => !localDate || m.localDate === localDate)
      .map((r) => this.strip(r));
  }
  async addMeal(userId: string, type: string, localDate: string, localTime: string) {
    const row = { id: randomUUID(), userId, timestamp: new Date(), localDate, localTime, type };
    this.meals.push(row);
    return this.strip(row);
  }
  async deleteMeal(userId: string, id: string) {
    return this.remove(this.meals, userId, id);
  }

  async listSupplementIntake(userId: string, localDate?: string) {
    return this.mine(this.supplementIntake, userId)
      .filter((m) => !localDate || m.localDate === localDate)
      .map((r) => this.strip(r));
  }
  async addSupplementIntake(userId: string, name: string, dosage: string, localDate: string) {
    const row = { id: randomUUID(), userId, timestamp: new Date(), localDate, name, dosage };
    this.supplementIntake.push(row);
    return this.strip(row);
  }
  async deleteSupplementIntake(userId: string, id: string) {
    return this.remove(this.supplementIntake, userId, id);
  }

  async listPeriods(userId: string) {
    return this.mine(this.periods, userId)
      .map((r) => this.strip(r))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
  async addPeriods(userId: string, entries: { startDate: string; endDate?: string }[]) {
    const existing = new Set(this.mine(this.periods, userId).map((p) => p.startDate));
    let added = 0;
    for (const e of entries) {
      if (existing.has(e.startDate)) continue;
      existing.add(e.startDate);
      this.periods.push({ id: randomUUID(), userId, startDate: e.startDate, endDate: e.endDate ?? null });
      added++;
    }
    return added;
  }
  async deletePeriod(userId: string, id: string) {
    return this.remove(this.periods, userId, id);
  }

  async listWearableSamples(userId: string, from?: string) {
    return this.mine(this.samples, userId)
      .filter((s) => !from || s.date >= from)
      .map((r) => this.strip(r));
  }
  async upsertWearableSamples(userId: string, samples: WearableSampleRecord[]) {
    for (const s of samples) {
      const i = this.samples.findIndex((x) => x.userId === userId && x.date === s.date && x.metric === s.metric && x.source === s.source);
      if (i >= 0) this.samples[i] = { ...s, userId };
      else this.samples.push({ ...s, userId });
    }
    return samples.length;
  }

  async listMidas(userId: string) {
    return this.mine(this.midas, userId).map((r) => this.strip(r));
  }
  async addMidas(userId: string, date: string, answers: MidasRecord["answers"]) {
    const row = { id: randomUUID(), userId, date, answers };
    this.midas.push(row);
    return this.strip(row);
  }

  async getIntegration(userId: string, provider: string) {
    const row = this.integrations.find((i) => i.userId === userId && i.provider === provider);
    return row ? this.strip(row) : null;
  }
  async saveIntegration(userId: string, record: IntegrationRecord) {
    this.integrations = this.integrations.filter((i) => !(i.userId === userId && i.provider === record.provider));
    this.integrations.push({ ...record, userId });
  }

  async deleteAllUserData(userId: string) {
    this.profiles.delete(userId);
    const keep = <T extends { userId: string }>(rows: T[]) => rows.filter((r) => r.userId !== userId);
    this.medications = keep(this.medications);
    this.supplements = keep(this.supplements);
    this.attacks = keep(this.attacks);
    this.dailyLogs = keep(this.dailyLogs);
    this.water = keep(this.water);
    this.meals = keep(this.meals);
    this.supplementIntake = keep(this.supplementIntake);
    this.periods = keep(this.periods);
    this.samples = keep(this.samples);
    this.midas = keep(this.midas);
    this.integrations = keep(this.integrations);
  }
}

// ---------------------------------------------------------------------------------------
// Postgres storage (production).

type Db = typeof import("./db").db;

/** Drizzle returns null for empty columns; the API uses undefined. */
function compact<T extends Record<string, unknown>>(row: T): { [K in keyof T]: Exclude<T[K], null> } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== null) out[k] = v;
  return out as { [K in keyof T]: Exclude<T[K], null> };
}

export class DbStorage implements IStorage {
  constructor(private db: Db) {}

  async getProfile(userId: string) {
    const [row] = await this.db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
    if (!row) return defaultProfile();
    const base = defaultProfile();
    return {
      profile: { ...base.profile, ...(row.profile as ProfileInput) },
      patterns: { ...base.patterns, ...(row.patterns as PatternsInput) },
      timezone: row.timezone,
    };
  }
  async saveProfile(userId: string, update: Partial<ProfileRecord>) {
    const next = { ...(await this.getProfile(userId)), ...update };
    await this.db
      .insert(schema.profiles)
      .values({ userId, profile: next.profile, patterns: next.patterns, timezone: next.timezone })
      .onConflictDoUpdate({
        target: schema.profiles.userId,
        set: { profile: next.profile, patterns: next.patterns, timezone: next.timezone, updatedAt: new Date() },
      });
    return next;
  }

  private medicationRow(r: typeof schema.medications.$inferSelect): MedicationRecord {
    const { userId: _u, createdAt: _c, ...rest } = compact(r);
    return rest as MedicationRecord;
  }
  async listMedications(userId: string) {
    const rows = await this.db.select().from(schema.medications).where(eq(schema.medications.userId, userId)).orderBy(asc(schema.medications.createdAt));
    return rows.map((r) => this.medicationRow(r));
  }
  async createMedication(userId: string, input: MedicationInput) {
    const [row] = await this.db.insert(schema.medications).values({ ...input, userId }).returning();
    return this.medicationRow(row);
  }
  async updateMedication(userId: string, id: string, input: MedicationInput) {
    const [row] = await this.db
      .update(schema.medications)
      .set({ dose: null, frequency: null, schedule: null, reason: null, prescriber: null, startDate: null, endDate: null, ...input })
      .where(and(eq(schema.medications.userId, userId), eq(schema.medications.id, id)))
      .returning();
    return row ? this.medicationRow(row) : null;
  }
  async deleteMedication(userId: string, id: string) {
    const rows = await this.db.delete(schema.medications).where(and(eq(schema.medications.userId, userId), eq(schema.medications.id, id))).returning();
    return rows.length > 0;
  }

  private supplementRow(r: typeof schema.supplements.$inferSelect): SupplementRecord {
    const { userId: _u, ...rest } = compact(r);
    return rest as SupplementRecord;
  }
  async listSupplements(userId: string) {
    const rows = await this.db.select().from(schema.supplements).where(eq(schema.supplements.userId, userId));
    return rows.map((r) => this.supplementRow(r));
  }
  async createSupplement(userId: string, input: SupplementInput) {
    const [row] = await this.db.insert(schema.supplements).values({ ...input, userId }).returning();
    return this.supplementRow(row);
  }
  async updateSupplement(userId: string, id: string, input: SupplementInput) {
    const [row] = await this.db
      .update(schema.supplements)
      .set({ dailyMg: null, startDate: null, ...input })
      .where(and(eq(schema.supplements.userId, userId), eq(schema.supplements.id, id)))
      .returning();
    return row ? this.supplementRow(row) : null;
  }
  async deleteSupplement(userId: string, id: string) {
    const rows = await this.db.delete(schema.supplements).where(and(eq(schema.supplements.userId, userId), eq(schema.supplements.id, id))).returning();
    return rows.length > 0;
  }

  private attackRow(r: typeof schema.attacks.$inferSelect): AttackRecord {
    return { ...(r.details as AttackInput), id: r.id, start: r.start, end: r.end ?? undefined, peakSeverity: r.peakSeverity };
  }
  private attackValues(input: AttackInput) {
    const { start, end, peakSeverity, ...details } = input;
    return { start, end: end ?? null, peakSeverity, details };
  }
  async listAttacks(userId: string) {
    const rows = await this.db.select().from(schema.attacks).where(eq(schema.attacks.userId, userId)).orderBy(desc(schema.attacks.start));
    return rows.map((r) => this.attackRow(r));
  }
  async createAttack(userId: string, input: AttackInput) {
    const [row] = await this.db.insert(schema.attacks).values({ ...this.attackValues(input), userId }).returning();
    return this.attackRow(row);
  }
  async updateAttack(userId: string, id: string, input: AttackInput) {
    const [row] = await this.db
      .update(schema.attacks)
      .set(this.attackValues(input))
      .where(and(eq(schema.attacks.userId, userId), eq(schema.attacks.id, id)))
      .returning();
    return row ? this.attackRow(row) : null;
  }
  async deleteAttack(userId: string, id: string) {
    const rows = await this.db.delete(schema.attacks).where(and(eq(schema.attacks.userId, userId), eq(schema.attacks.id, id))).returning();
    return rows.length > 0;
  }

  async listDailyLogs(userId: string, from?: string, to?: string) {
    const conds = [eq(schema.dailyLogs.userId, userId)];
    if (from) conds.push(gte(schema.dailyLogs.date, from));
    if (to) conds.push(lte(schema.dailyLogs.date, to));
    const rows = await this.db.select().from(schema.dailyLogs).where(and(...conds)).orderBy(asc(schema.dailyLogs.date));
    return rows.map((r) => ({ ...(r.data as DailyLogInput), date: r.date }));
  }
  async upsertDailyLog(userId: string, date: string, input: DailyLogInput) {
    await this.db
      .insert(schema.dailyLogs)
      .values({ userId, date, data: input })
      .onConflictDoUpdate({ target: [schema.dailyLogs.userId, schema.dailyLogs.date], set: { data: input, updatedAt: new Date() } });
    return { ...input, date };
  }

  async listWater(userId: string, localDate?: string) {
    const conds = [eq(schema.waterLog.userId, userId)];
    if (localDate) conds.push(eq(schema.waterLog.localDate, localDate));
    return this.db
      .select({ id: schema.waterLog.id, timestamp: schema.waterLog.timestamp, localDate: schema.waterLog.localDate, amount: schema.waterLog.amount })
      .from(schema.waterLog)
      .where(and(...conds))
      .orderBy(asc(schema.waterLog.timestamp));
  }
  async addWater(userId: string, amount: number, localDate: string) {
    const [row] = await this.db.insert(schema.waterLog).values({ userId, amount, localDate }).returning();
    return { id: row.id, timestamp: row.timestamp, localDate: row.localDate, amount: row.amount };
  }
  async deleteWater(userId: string, id: string) {
    const rows = await this.db.delete(schema.waterLog).where(and(eq(schema.waterLog.userId, userId), eq(schema.waterLog.id, id))).returning();
    return rows.length > 0;
  }

  async listMeals(userId: string, localDate?: string) {
    const conds = [eq(schema.mealLog.userId, userId)];
    if (localDate) conds.push(eq(schema.mealLog.localDate, localDate));
    return this.db
      .select({ id: schema.mealLog.id, timestamp: schema.mealLog.timestamp, localDate: schema.mealLog.localDate, localTime: schema.mealLog.localTime, type: schema.mealLog.type })
      .from(schema.mealLog)
      .where(and(...conds))
      .orderBy(asc(schema.mealLog.timestamp));
  }
  async addMeal(userId: string, type: string, localDate: string, localTime: string) {
    const [row] = await this.db.insert(schema.mealLog).values({ userId, type, localDate, localTime }).returning();
    return { id: row.id, timestamp: row.timestamp, localDate: row.localDate, localTime: row.localTime, type: row.type };
  }
  async deleteMeal(userId: string, id: string) {
    const rows = await this.db.delete(schema.mealLog).where(and(eq(schema.mealLog.userId, userId), eq(schema.mealLog.id, id))).returning();
    return rows.length > 0;
  }

  async listSupplementIntake(userId: string, localDate?: string) {
    const conds = [eq(schema.supplementLog.userId, userId)];
    if (localDate) conds.push(eq(schema.supplementLog.localDate, localDate));
    return this.db
      .select({ id: schema.supplementLog.id, timestamp: schema.supplementLog.timestamp, localDate: schema.supplementLog.localDate, name: schema.supplementLog.name, dosage: schema.supplementLog.dosage })
      .from(schema.supplementLog)
      .where(and(...conds))
      .orderBy(asc(schema.supplementLog.timestamp));
  }
  async addSupplementIntake(userId: string, name: string, dosage: string, localDate: string) {
    const [row] = await this.db.insert(schema.supplementLog).values({ userId, name, dosage, localDate }).returning();
    return { id: row.id, timestamp: row.timestamp, localDate: row.localDate, name: row.name, dosage: row.dosage };
  }
  async deleteSupplementIntake(userId: string, id: string) {
    const rows = await this.db.delete(schema.supplementLog).where(and(eq(schema.supplementLog.userId, userId), eq(schema.supplementLog.id, id))).returning();
    return rows.length > 0;
  }

  async listPeriods(userId: string) {
    return this.db
      .select({ id: schema.cycleLog.id, startDate: schema.cycleLog.startDate, endDate: schema.cycleLog.endDate })
      .from(schema.cycleLog)
      .where(eq(schema.cycleLog.userId, userId))
      .orderBy(asc(schema.cycleLog.startDate));
  }
  async addPeriods(userId: string, entries: { startDate: string; endDate?: string }[]) {
    const existing = new Set((await this.listPeriods(userId)).map((p) => p.startDate));
    const fresh = entries.filter((e, i) => !existing.has(e.startDate) && entries.findIndex((x) => x.startDate === e.startDate) === i);
    if (!fresh.length) return 0;
    await this.db.insert(schema.cycleLog).values(fresh.map((e) => ({ userId, startDate: e.startDate, endDate: e.endDate ?? null })));
    return fresh.length;
  }
  async deletePeriod(userId: string, id: string) {
    const rows = await this.db.delete(schema.cycleLog).where(and(eq(schema.cycleLog.userId, userId), eq(schema.cycleLog.id, id))).returning();
    return rows.length > 0;
  }

  async listWearableSamples(userId: string, from?: string) {
    const conds = [eq(schema.wearableSamples.userId, userId)];
    if (from) conds.push(gte(schema.wearableSamples.date, from));
    return this.db
      .select({ date: schema.wearableSamples.date, metric: schema.wearableSamples.metric, value: schema.wearableSamples.value, source: schema.wearableSamples.source })
      .from(schema.wearableSamples)
      .where(and(...conds))
      .orderBy(asc(schema.wearableSamples.date));
  }
  async upsertWearableSamples(userId: string, samples: WearableSampleRecord[]) {
    for (let i = 0; i < samples.length; i += 500) {
      const chunk = samples.slice(i, i + 500).map((s) => ({ ...s, userId }));
      await this.db
        .insert(schema.wearableSamples)
        .values(chunk)
        .onConflictDoUpdate({
          target: [schema.wearableSamples.userId, schema.wearableSamples.date, schema.wearableSamples.metric, schema.wearableSamples.source],
          // `excluded` is the row being inserted: a re-sync replaces the stored value.
          set: { value: sql`excluded.value` },
        });
    }
    return samples.length;
  }

  async listMidas(userId: string) {
    const rows = await this.db.select().from(schema.midasAssessments).where(eq(schema.midasAssessments.userId, userId));
    return rows.map((r) => ({ id: r.id, date: r.date, answers: r.answers as MidasRecord["answers"] }));
  }
  async addMidas(userId: string, date: string, answers: MidasRecord["answers"]) {
    const [row] = await this.db.insert(schema.midasAssessments).values({ userId, date, answers }).returning();
    return { id: row.id, date: row.date, answers: row.answers as MidasRecord["answers"] };
  }

  async getIntegration(userId: string, provider: string) {
    const [row] = await this.db
      .select()
      .from(schema.integrations)
      .where(and(eq(schema.integrations.userId, userId), eq(schema.integrations.provider, provider)));
    return row ? { provider: row.provider, externalUserId: row.externalUserId, lastSyncedAt: row.lastSyncedAt } : null;
  }
  async saveIntegration(userId: string, record: IntegrationRecord) {
    await this.db
      .insert(schema.integrations)
      .values({ userId, ...record })
      .onConflictDoUpdate({
        target: [schema.integrations.userId, schema.integrations.provider],
        set: { externalUserId: record.externalUserId, lastSyncedAt: record.lastSyncedAt },
      });
  }

  async deleteAllUserData(userId: string) {
    const tables = [
      schema.medications, schema.supplements, schema.attacks, schema.dailyLogs, schema.waterLog, schema.mealLog,
      schema.supplementLog, schema.cycleLog, schema.wearableSamples, schema.midasAssessments,
    ] as const;
    for (const t of tables) await this.db.delete(t).where(eq(t.userId, userId));
    await this.db.delete(schema.profiles).where(eq(schema.profiles.userId, userId));
    await this.db.delete(schema.integrations).where(eq(schema.integrations.userId, userId));
  }
}

export async function createStorage(): Promise<IStorage> {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL must be set in production");
    console.warn("[aura] DATABASE_URL not set: using in-memory storage (data is lost on restart)");
    return new MemStorage();
  }
  const { db } = await import("./db");
  return new DbStorage(db);
}
