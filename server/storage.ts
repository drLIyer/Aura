import { randomUUID } from "crypto";

interface WaterEntry {
  id: string;
  timestamp: Date;
  amount: number;
}

interface SupplementEntry {
  id: string;
  timestamp: Date;
  name: string;
  dosage: string;
}

interface MealEntry {
  id: string;
  timestamp: Date;
  type: string;
}

interface MigraineEntry {
  id: string;
  timestamp: Date;
  severity: number;
  duration: number;
  symptoms: string[];
  triggers: string;
  notes: string;
  medications?: string;
}

interface CycleEntry {
  id: string;
  startDate: string;
  endDate?: string;
  cycleLength?: number;
}

interface UserProfileEntry {
  id: string;
  userId: string;
  age?: number;
  sex?: string;
  contraceptiveUse?: string;
}

interface LifestyleEntry {
  id: string;
  timestamp: Date;
  caffeineIntake?: number;
  alcoholIntake?: number;
  perceivedStress?: number;
}

interface HealthMetricsEntry {
  id: string;
  date: string;
  readiness: number;
  sleep: number;
  stress: number;
}

export interface IStorage {
  getWaterLog(date?: string): Promise<WaterEntry[]>;
  addWaterLog(amount: number, date?: string): Promise<WaterEntry>;
  getSupplementLog(date?: string): Promise<SupplementEntry[]>;
  addSupplementLog(name: string, dosage: string, date?: string): Promise<SupplementEntry>;
  getMealLog(): Promise<MealEntry[]>;
  addMealLog(type: string): Promise<MealEntry>;
  getMigraineLog(): Promise<MigraineEntry[]>;
  addMigraineLog(severity: number, duration: number, symptoms: string[], triggers: string, notes: string, medications?: string): Promise<MigraineEntry>;
  getCycleLog(): Promise<CycleEntry[]>;
  addCycleLog(startDate: string, endDate?: string): Promise<CycleEntry>;
  getUserProfile(): Promise<UserProfileEntry | null>;
  updateUserProfile(age?: number, sex?: string, contraceptiveUse?: string): Promise<UserProfileEntry>;
  getLifestyleLog(): Promise<LifestyleEntry[]>;
  addLifestyleLog(caffeineIntake?: number, alcoholIntake?: number, perceivedStress?: number): Promise<LifestyleEntry>;
  getHealthMetrics(date: string): Promise<HealthMetricsEntry | null>;
  upsertHealthMetrics(date: string, readiness: number, sleep: number, stress: number): Promise<HealthMetricsEntry>;
  getHealthMetricsTrend(days: number): Promise<HealthMetricsEntry[]>;
}

export class MemStorage implements IStorage {
  private waterLog: Map<string, WaterEntry>;
  private supplementLog: Map<string, SupplementEntry>;
  private mealLog: Map<string, MealEntry>;
  private migraineLog: Map<string, MigraineEntry>;
  private cycleLog: Map<string, CycleEntry>;

  constructor() {
    this.waterLog = new Map();
    this.supplementLog = new Map();
    this.mealLog = new Map();
    this.migraineLog = new Map();
    this.cycleLog = new Map();
    
    // Initialize with today's sample data
    void this.initializeSampleData();
  }

  private async initializeSampleData() {
    // Sample water entries
    const water1 = await this.addWaterLog(500);
    water1.timestamp = new Date(new Date().setHours(8, 30));
    
    const water2 = await this.addWaterLog(250);
    water2.timestamp = new Date(new Date().setHours(11, 15));
    
    const water3 = await this.addWaterLog(450);
    water3.timestamp = new Date(new Date().setHours(14, 45));
    
    // Sample supplement entries
    await this.addSupplementLog('CoQ10', '300mg');
    await this.addSupplementLog('Magnesium Citrate', '400mg');
    
    // Sample meal entries
    const meal1 = await this.addMealLog('Breakfast');
    meal1.timestamp = new Date(new Date().setHours(7, 30));
    
    const meal2 = await this.addMealLog('Lunch');
    meal2.timestamp = new Date(new Date().setHours(12, 45));
    
    // Sample cycle entry
    await this.addCycleLog('2024-01-15', '2024-01-20');
  }

  async getWaterLog(date?: string): Promise<WaterEntry[]> {
    let entries = Array.from(this.waterLog.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    if (date) {
      const targetDate = new Date(date + 'T00:00:00');
      const targetDateStr = targetDate.toDateString();
      entries = entries.filter(e => {
        return new Date(e.timestamp).toDateString() === targetDateStr;
      });
    }
    return entries;
  }

  async addWaterLog(amount: number, date?: string): Promise<WaterEntry> {
    const id = randomUUID();
    const timestamp = date ? new Date(date + 'T12:00:00') : new Date();
    const entry: WaterEntry = {
      id,
      timestamp,
      amount
    };
    this.waterLog.set(id, entry);
    return entry;
  }

  async getSupplementLog(date?: string): Promise<SupplementEntry[]> {
    let entries = Array.from(this.supplementLog.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    if (date) {
      const targetDate = new Date(date + 'T00:00:00');
      const targetDateStr = targetDate.toDateString();
      entries = entries.filter(e => {
        return new Date(e.timestamp).toDateString() === targetDateStr;
      });
    }
    return entries;
  }

  async addSupplementLog(name: string, dosage: string, date?: string): Promise<SupplementEntry> {
    const id = randomUUID();
    const timestamp = date ? new Date(date + 'T12:00:00') : new Date();
    const entry: SupplementEntry = {
      id,
      timestamp,
      name,
      dosage
    };
    this.supplementLog.set(id, entry);
    return entry;
  }

  async getMealLog(): Promise<MealEntry[]> {
    return Array.from(this.mealLog.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async addMealLog(type: string): Promise<MealEntry> {
    const id = randomUUID();
    const entry: MealEntry = {
      id,
      timestamp: new Date(),
      type
    };
    this.mealLog.set(id, entry);
    return entry;
  }

  async getMigraineLog(): Promise<MigraineEntry[]> {
    return Array.from(this.migraineLog.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async addMigraineLog(severity: number, duration: number, symptoms: string[], triggers: string, notes: string = '', medications?: string): Promise<MigraineEntry> {
    const id = randomUUID();
    const entry: MigraineEntry = {
      id,
      timestamp: new Date(),
      severity,
      duration,
      symptoms,
      triggers,
      notes,
      medications
    };
    this.migraineLog.set(id, entry);
    return entry;
  }

  async getCycleLog(): Promise<CycleEntry[]> {
    return Array.from(this.cycleLog.values()).sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  }

  async addCycleLog(startDate: string, endDate?: string): Promise<CycleEntry> {
    const id = randomUUID();
    const entry: CycleEntry = {
      id,
      startDate,
      endDate,
      cycleLength: endDate ? this.calculateCycleLength(startDate, endDate) : undefined
    };
    this.cycleLog.set(id, entry);
    return entry;
  }

  private calculateCycleLength(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  async getUserProfile(): Promise<UserProfileEntry | null> {
    // MemStorage doesn't persist user profile
    return null;
  }

  async updateUserProfile(age?: number, sex?: string, contraceptiveUse?: string): Promise<UserProfileEntry> {
    // MemStorage stub implementation
    return {
      id: randomUUID(),
      userId: 'default_user',
      age,
      sex,
      contraceptiveUse
    };
  }

  async getLifestyleLog(): Promise<LifestyleEntry[]> {
    // MemStorage doesn't persist lifestyle log
    return [];
  }

  async addLifestyleLog(caffeineIntake?: number, alcoholIntake?: number, perceivedStress?: number): Promise<LifestyleEntry> {
    // MemStorage stub implementation
    return {
      id: randomUUID(),
      timestamp: new Date(),
      caffeineIntake,
      alcoholIntake,
      perceivedStress
    };
  }

  private healthMetricsStore: Map<string, HealthMetricsEntry> = new Map();

  async getHealthMetrics(date: string): Promise<HealthMetricsEntry | null> {
    return this.healthMetricsStore.get(date) || null;
  }

  async upsertHealthMetrics(date: string, readiness: number, sleep: number, stress: number): Promise<HealthMetricsEntry> {
    const existing = this.healthMetricsStore.get(date);
    const entry: HealthMetricsEntry = {
      id: existing?.id || randomUUID(),
      date,
      readiness,
      sleep,
      stress
    };
    this.healthMetricsStore.set(date, entry);
    return entry;
  }

  async getHealthMetricsTrend(days: number): Promise<HealthMetricsEntry[]> {
    const entries = Array.from(this.healthMetricsStore.values());
    return entries.sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
  }
}

// Database storage implementation
import { db } from "./db";
import * as schema from "@shared/schema";
import { desc, asc, eq, and, gte, lt, sql } from "drizzle-orm";
import type { WaterLog, SupplementLog, MealLog, MigraineLog, CycleLog } from "@shared/schema";

export class DbStorage implements IStorage {
  async getWaterLog(date?: string): Promise<WaterEntry[]> {
    let query = db.select().from(schema.waterLog);
    
    if (date) {
      // Create clean start/end dates without mutating
      const startOfDay = new Date(date + 'T00:00:00');
      const endOfDay = new Date(date + 'T23:59:59.999');
      query = query.where(
        and(
          gte(schema.waterLog.timestamp, startOfDay),
          lt(schema.waterLog.timestamp, new Date(endOfDay.getTime() + 1))
        )
      ) as any;
    }
    
    const entries = await query.orderBy(asc(schema.waterLog.timestamp));
    return entries.map((e: WaterLog) => ({
      id: e.id,
      timestamp: new Date(e.timestamp),
      amount: e.amount
    }));
  }

  async addWaterLog(amount: number, date?: string): Promise<WaterEntry> {
    const timestamp = date ? new Date(date + 'T12:00:00') : new Date();
    const [entry] = await db.insert(schema.waterLog).values({ amount, timestamp }).returning();
    return {
      id: entry.id,
      timestamp: new Date(entry.timestamp),
      amount: entry.amount
    };
  }

  async getSupplementLog(date?: string): Promise<SupplementEntry[]> {
    let query = db.select().from(schema.supplementLog);
    
    if (date) {
      // Create clean start/end dates without mutating
      const startOfDay = new Date(date + 'T00:00:00');
      const endOfDay = new Date(date + 'T23:59:59.999');
      query = query.where(
        and(
          gte(schema.supplementLog.timestamp, startOfDay),
          lt(schema.supplementLog.timestamp, new Date(endOfDay.getTime() + 1))
        )
      ) as any;
    }
    
    const entries = await query.orderBy(asc(schema.supplementLog.timestamp));
    return entries.map((e: SupplementLog) => ({
      id: e.id,
      timestamp: new Date(e.timestamp),
      name: e.name,
      dosage: e.dosage
    }));
  }

  async addSupplementLog(name: string, dosage: string, date?: string): Promise<SupplementEntry> {
    const timestamp = date ? new Date(date + 'T12:00:00') : new Date();
    const [entry] = await db.insert(schema.supplementLog).values({ name, dosage, timestamp }).returning();
    return {
      id: entry.id,
      timestamp: new Date(entry.timestamp),
      name: entry.name,
      dosage: entry.dosage
    };
  }

  async getMealLog(): Promise<MealEntry[]> {
    const entries = await db.select().from(schema.mealLog).orderBy(asc(schema.mealLog.timestamp));
    return entries.map((e: MealLog) => ({
      id: e.id,
      timestamp: new Date(e.timestamp),
      type: e.type
    }));
  }

  async addMealLog(type: string): Promise<MealEntry> {
    const [entry] = await db.insert(schema.mealLog).values({ type }).returning();
    return {
      id: entry.id,
      timestamp: new Date(entry.timestamp),
      type: entry.type
    };
  }

  async getMigraineLog(): Promise<MigraineEntry[]> {
    const entries = await db.select().from(schema.migraineLog).orderBy(desc(schema.migraineLog.timestamp));
    return entries.map((e: MigraineLog) => ({
      id: e.id,
      timestamp: new Date(e.timestamp),
      severity: e.severity,
      duration: e.duration,
      symptoms: e.symptoms,
      triggers: e.triggers || '',
      notes: e.notes || '',
      medications: e.medications || undefined
    }));
  }

  async addMigraineLog(severity: number, duration: number, symptoms: string[], triggers: string, notes: string = '', medications?: string): Promise<MigraineEntry> {
    const [entry] = await db.insert(schema.migraineLog).values({ 
      severity, 
      duration, 
      symptoms, 
      triggers,
      notes,
      medications
    }).returning();
    return {
      id: entry.id,
      timestamp: new Date(entry.timestamp),
      severity: entry.severity,
      duration: entry.duration,
      symptoms: entry.symptoms,
      triggers: entry.triggers || '',
      notes: entry.notes || '',
      medications: entry.medications || undefined
    };
  }

  async getCycleLog(): Promise<CycleEntry[]> {
    const entries = await db.select().from(schema.cycleLog).orderBy(desc(schema.cycleLog.startDate));
    return entries.map((e: CycleLog) => ({
      id: e.id,
      startDate: e.startDate,
      endDate: e.endDate || undefined,
      cycleLength: e.cycleLength || undefined
    }));
  }

  async addCycleLog(startDate: string, endDate?: string): Promise<CycleEntry> {
    const cycleLength = endDate ? this.calculateCycleLength(startDate, endDate) : undefined;
    const [entry] = await db.insert(schema.cycleLog).values({ 
      startDate, 
      endDate,
      cycleLength 
    }).returning();
    return {
      id: entry.id,
      startDate: entry.startDate,
      endDate: entry.endDate || undefined,
      cycleLength: entry.cycleLength || undefined
    };
  }

  private calculateCycleLength(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  async getUserProfile(): Promise<UserProfileEntry | null> {
    const [profile] = await db.select().from(schema.userProfile).limit(1);
    if (!profile) return null;
    return {
      id: profile.id,
      userId: profile.userId,
      age: profile.age || undefined,
      sex: profile.sex || undefined,
      contraceptiveUse: profile.contraceptiveUse || undefined
    };
  }

  async updateUserProfile(age?: number, sex?: string, contraceptiveUse?: string): Promise<UserProfileEntry> {
    // Check if profile exists
    const existing = await this.getUserProfile();
    
    if (existing) {
      // Update existing profile
      const [updated] = await db.update(schema.userProfile)
        .set({ age, sex, contraceptiveUse })
        .where(eq(schema.userProfile.userId, 'default_user'))
        .returning();
      return {
        id: updated.id,
        userId: updated.userId,
        age: updated.age || undefined,
        sex: updated.sex || undefined,
        contraceptiveUse: updated.contraceptiveUse || undefined
      };
    } else {
      // Create new profile
      const [created] = await db.insert(schema.userProfile)
        .values({ age, sex, contraceptiveUse })
        .returning();
      return {
        id: created.id,
        userId: created.userId,
        age: created.age || undefined,
        sex: created.sex || undefined,
        contraceptiveUse: created.contraceptiveUse || undefined
      };
    }
  }

  async getLifestyleLog(): Promise<LifestyleEntry[]> {
    const entries = await db.select().from(schema.lifestyleLog).orderBy(desc(schema.lifestyleLog.timestamp));
    return entries.map(e => ({
      id: e.id,
      timestamp: new Date(e.timestamp),
      caffeineIntake: e.caffeineIntake || undefined,
      alcoholIntake: e.alcoholIntake || undefined,
      perceivedStress: e.perceivedStress || undefined
    }));
  }

  async addLifestyleLog(caffeineIntake?: number, alcoholIntake?: number, perceivedStress?: number): Promise<LifestyleEntry> {
    const [entry] = await db.insert(schema.lifestyleLog)
      .values({ caffeineIntake, alcoholIntake, perceivedStress })
      .returning();
    return {
      id: entry.id,
      timestamp: new Date(entry.timestamp),
      caffeineIntake: entry.caffeineIntake || undefined,
      alcoholIntake: entry.alcoholIntake || undefined,
      perceivedStress: entry.perceivedStress || undefined
    };
  }

  async getHealthMetrics(date: string): Promise<HealthMetricsEntry | null> {
    const [entry] = await db.select().from(schema.healthMetrics).where(eq(schema.healthMetrics.date, date)).limit(1);
    if (!entry) return null;
    return {
      id: entry.id,
      date: entry.date,
      readiness: entry.readiness,
      sleep: entry.sleep,
      stress: entry.stress
    };
  }

  async upsertHealthMetrics(date: string, readiness: number, sleep: number, stress: number): Promise<HealthMetricsEntry> {
    const existing = await this.getHealthMetrics(date);
    
    if (existing) {
      const [updated] = await db.update(schema.healthMetrics)
        .set({ readiness, sleep, stress })
        .where(eq(schema.healthMetrics.date, date))
        .returning();
      return {
        id: updated.id,
        date: updated.date,
        readiness: updated.readiness,
        sleep: updated.sleep,
        stress: updated.stress
      };
    } else {
      const [created] = await db.insert(schema.healthMetrics)
        .values({ date, readiness, sleep, stress })
        .returning();
      return {
        id: created.id,
        date: created.date,
        readiness: created.readiness,
        sleep: created.sleep,
        stress: created.stress
      };
    }
  }

  async getHealthMetricsTrend(days: number): Promise<HealthMetricsEntry[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const entries = await db.select().from(schema.healthMetrics)
      .where(gte(schema.healthMetrics.date, startDateStr))
      .orderBy(asc(schema.healthMetrics.date));

    return entries.map(e => ({
      id: e.id,
      date: e.date,
      readiness: e.readiness,
      sleep: e.sleep,
      stress: e.stress
    }));
  }
}

export const storage = new DbStorage();
