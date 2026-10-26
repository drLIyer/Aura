import type { AppState, DailyLog, WearableMetric } from "@shared/engine/domain/types";
import { addDays } from "@shared/engine/domain/dates";
import type { IStorage } from "./storage";

/** How far back the engine looks. Long enough for trends, short enough to stay fast. */
export const HISTORY_DAYS = 400;

/**
 * Builds the engine's view of one user from storage. Times are passed to the engine as local
 * wall-clock strings (no offset), so every date the engine derives is the user's own calendar date.
 */
export async function buildAppState(storage: IStorage, userId: string, today: string): Promise<AppState> {
  const from = addDays(today, -HISTORY_DAYS);
  const [profile, medications, supplements, attacks, logs, water, meals, periods, samples, midas] = await Promise.all([
    storage.getProfile(userId),
    storage.listMedications(userId),
    storage.listSupplements(userId),
    storage.listAttacks(userId),
    storage.listDailyLogs(userId, from, today),
    storage.listWater(userId),
    storage.listMeals(userId),
    storage.listPeriods(userId),
    storage.listWearableSamples(userId, from),
    storage.listMidas(userId),
  ]);

  // Quick logs enrich the check-in for the same day, without overriding what the user typed.
  const waterByDate = new Map<string, number>();
  for (const w of water) if (w.localDate) waterByDate.set(w.localDate, (waterByDate.get(w.localDate) ?? 0) + w.amount);
  const lunchByDate = new Map<string, string>();
  for (const m of meals) if (m.type === "Lunch" && m.localDate && m.localTime) lunchByDate.set(m.localDate, m.localTime);

  const dailyLogs: DailyLog[] = logs.map((l) => ({
    ...l,
    waterLiters: l.waterLiters ?? (waterByDate.has(l.date) ? waterByDate.get(l.date)! / 1000 : undefined),
    lunchTime: l.lunchTime ?? lunchByDate.get(l.date),
  }));

  return {
    version: 1,
    profile: profile.profile,
    patterns: profile.patterns,
    medications,
    supplements,
    attacks: attacks.filter((a) => a.start.slice(0, 10) >= from),
    dailyLogs,
    periods: periods.map((p) => ({ start: p.startDate, end: p.endDate ?? undefined })),
    wearableSamples: samples.map((s) => ({ date: s.date, metric: s.metric as WearableMetric, value: s.value, source: s.source })),
    midas,
  };
}
