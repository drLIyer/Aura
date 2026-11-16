import { createRequire } from "module";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@shared/schema";
import { DbStorage } from "../storage";
import { buildAppState } from "../engineState";
import { evaluate } from "@shared/engine/cds/engine";

/**
 * Runs the Postgres storage against an embedded Postgres, with tables created from
 * shared/schema.ts the same way `npm run db:push` would.
 */
let storage: DbStorage;

beforeAll(async () => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  // The ESM build of drizzle-kit/api uses require() internally, so load the CommonJS one.
  const kit = createRequire(import.meta.url)("drizzle-kit/api") as typeof import("drizzle-kit/api");
  const sql = await kit.generateMigration(await kit.generateDrizzleJson({}), await kit.generateDrizzleJson(schema));
  for (const stmt of sql) await client.exec(stmt);
  storage = new DbStorage(db as never);
}, 60_000);

describe("DbStorage (Postgres)", () => {
  it("round-trips every record type and scopes it to the user", async () => {
    const med = await storage.createMedication("u1", { name: "Sumatriptan", cls: "triptan", role: "acute", overTheCounter: false, active: true, dose: "50 mg" });
    expect(med.dose).toBe("50 mg");
    expect(await storage.listMedications("u2")).toEqual([]);

    const attack = await storage.createAttack("u1", {
      start: "2026-10-20T14:00",
      peakSeverity: 7,
      painLocations: [],
      painQualities: ["throbbing"],
      symptoms: ["aura-visual"],
      auraMinutes: 20,
      worsenedByActivity: true,
      triggers: ["late-meal"],
      alleviators: [],
      exacerbators: [],
      doses: [{ medicationId: med.id, takenAt: "2026-10-20T14:30", reliefAt2h: "pain-free" }],
      disability: "moderate",
      redFlags: [],
    });
    const [back] = await storage.listAttacks("u1");
    expect(back).toMatchObject({ id: attack.id, start: "2026-10-20T14:00", auraMinutes: 20, doses: [{ reliefAt2h: "pain-free" }] });
    expect(await storage.updateAttack("u2", attack.id, back)).toBeNull();

    await storage.upsertDailyLog("u1", "2026-10-20", { stress: 6, lunchTime: "15:20", exposures: [], warningSigns: [], headache: true });
    await storage.upsertDailyLog("u1", "2026-10-20", { stress: 8, exposures: ["conflict"], warningSigns: [], headache: true });
    const logs = await storage.listDailyLogs("u1");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ date: "2026-10-20", stress: 8, exposures: ["conflict"] });

    expect(await storage.addPeriods("u1", [{ startDate: "2026-09-22" }, { startDate: "2026-10-19", endDate: "2026-10-23" }, { startDate: "2026-09-22" }])).toBe(2);
    expect(await storage.addPeriods("u1", [{ startDate: "2026-10-19" }])).toBe(0);

    await storage.addWater("u1", 500, "2026-10-20");
    await storage.addMeal("u1", "Lunch", "2026-10-20", "15:20");
    await storage.upsertWearableSamples("u1", [{ date: "2026-10-20", metric: "sleepScore", value: 61, source: "oura" }]);
    await storage.upsertWearableSamples("u1", [{ date: "2026-10-20", metric: "sleepScore", value: 64, source: "oura" }]);
    expect((await storage.listWearableSamples("u1")).map((s) => s.value)).toEqual([64]);

    await storage.saveProfile("u1", { patterns: { triggers: [{ id: "late-meal", likelihood: "often" }], customTriggers: [], alleviators: [], exacerbators: [], warningSigns: [] }, timezone: "America/Chicago" });
    expect((await storage.getProfile("u1")).timezone).toBe("America/Chicago");
    expect((await storage.getProfile("u1")).memory).toEqual({ lifeEvents: [], dismissedNotes: [] });
    const memory = { lifeEvents: [{ id: "e1", date: "2026-10-20", label: "New job", kind: "work" as const }], dismissedNotes: ["n1"] };
    await storage.saveProfile("u1", { memory });
    expect((await storage.getProfile("u1")).memory).toEqual(memory);
    expect((await storage.getProfile("u2")).memory).toEqual({ lifeEvents: [], dismissedNotes: [] });

    const state = await buildAppState(storage, "u1", "2026-10-26");
    expect(state.dailyLogs[0].waterLiters).toBe(0.5);
    expect(state.periods).toHaveLength(2);
    expect(Array.isArray(evaluate(state, "2026-10-26"))).toBe(true);

    await storage.deleteAllUserData("u1");
    expect(await storage.listAttacks("u1")).toEqual([]);
    expect(await storage.listPeriods("u1")).toEqual([]);
  });
});
