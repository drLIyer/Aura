import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type express from "express";
import { createApp } from "../app";
import { MemStorage } from "../storage";
import { generateMLDataset } from "../mlExport";
import { normalizeSummaries, OpenWearablesClient } from "../openWearables";
import { localDate, localDateTime, localTime } from "../time";
import { emptyState } from "@shared/engine/state";

process.env.NODE_ENV = "test";

async function devApp(storage = new MemStorage(), wearablesClient?: () => OpenWearablesClient) {
  const { app } = await createApp({ storage, authMode: "dev", wearablesClient });
  return { app, storage };
}

const as = (user: string) => {
  process.env.AURA_DEV_USER_ID = user;
};

const attack = {
  start: "2026-10-20T14:00",
  end: "2026-10-20T20:00",
  peakSeverity: 7,
  symptoms: ["nausea", "aura-visual"],
  auraMinutes: 20,
  auraOnset: "gradual",
};

describe("authentication", () => {
  it("refuses every data route when sign-in is not configured", async () => {
    const { app } = await createApp({ storage: new MemStorage(), authMode: "none" });
    for (const path of ["/api/attacks", "/api/medications", "/api/forecast", "/api/export/json"]) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(503);
    }
  });

  it("keeps each user's data separate", async () => {
    const { app } = await devApp();
    as("alice");
    await request(app).post("/api/attacks").send(attack).expect(201);
    await request(app).post("/api/medications").send({ name: "Sumatriptan", cls: "triptan", role: "acute" }).expect(201);
    as("bob");
    expect((await request(app).get("/api/attacks")).body).toEqual([]);
    expect((await request(app).get("/api/medications")).body).toEqual([]);
    as("alice");
    expect((await request(app).get("/api/attacks")).body).toHaveLength(1);
  });

  it("cannot change another user's record by id", async () => {
    const { app } = await devApp();
    as("alice");
    const created = await request(app).post("/api/attacks").send(attack).expect(201);
    as("bob");
    await request(app).put(`/api/attacks/${created.body.id}`).send(attack).expect(404);
    await request(app).delete(`/api/attacks/${created.body.id}`).expect(404);
  });

  afterEach(() => {
    delete process.env.AURA_DEV_USER_ID;
  });
});

describe("validation", () => {
  beforeEach(() => as("val"));

  it("rejects out-of-range and malformed input with reasons", async () => {
    const { app } = await devApp();
    const res = await request(app).post("/api/attacks").send({ ...attack, peakSeverity: 14 });
    expect(res.status).toBe(400);
    expect(res.body.issues[0].path).toBe("peakSeverity");
    await request(app).post("/api/attacks").send({ ...attack, end: "2026-10-19T10:00" }).expect(400);
    await request(app).post("/api/water").send({ amount: -5, localDate: "2026-10-20" }).expect(400);
    await request(app).put("/api/checkins/2026-10-20").send({ stress: 70 }).expect(400);
    await request(app).post("/api/medications").send({ name: "X", cls: "made-up", role: "acute" }).expect(400);
  });

  it("returns 404 JSON for unknown API paths", async () => {
    const { app } = await devApp();
    await request(app).get("/api/nope").expect(404);
  });
});

describe("dates and time zones", () => {
  beforeEach(() => as("tz"));

  it("converts instants to the user's calendar date and clock", () => {
    const evening = new Date("2026-10-27T03:30:00Z");
    expect(localDate(evening, "America/Los_Angeles")).toBe("2026-10-26");
    expect(localTime(evening, "America/Los_Angeles")).toBe("20:30");
    expect(localDateTime(evening, "Asia/Kolkata")).toBe("2026-10-27T09:00");
  });

  it("stores water against the date the user chose, not the server's date", async () => {
    const { app } = await devApp();
    await request(app).post("/api/water").send({ amount: 500, localDate: "2026-10-26" }).expect(201);
    expect((await request(app).get("/api/water?date=2026-10-26")).body).toHaveLength(1);
    expect((await request(app).get("/api/water?date=2026-10-27")).body).toHaveLength(0);
  });
});

describe("cycle", () => {
  beforeEach(() => as("cycle"));

  it("imports periods, skips duplicates and learns cycle length", async () => {
    const { app } = await devApp();
    const entries = [{ startDate: "2026-07-01" }, { startDate: "2026-07-31" }, { startDate: "2026-08-30" }, { startDate: "2026-07-01" }];
    const res = await request(app).post("/api/cycle/import").send({ entries }).expect(200);
    expect(res.body).toEqual({ added: 3, skipped: 1 });
    const cur = await request(app).get("/api/cycle/current?date=2026-09-27").expect(200);
    expect(cur.body.averageLength).toBe(30);
    expect(cur.body.nextStart).toBe("2026-09-29");
    expect(cur.body.inHigherRiskWindow).toBe(true);
  });
});

describe("decision support", () => {
  beforeEach(() => as("demo"));

  it("serves forecast, recommendations, insights and report from demo data", async () => {
    const { app } = await devApp();
    await request(app).post("/api/demo/load?date=2026-10-26").expect(200);
    const f = await request(app).get("/api/forecast?date=2026-10-26").expect(200);
    expect(f.body.probability).toBeGreaterThan(0);
    const patient = await request(app).get("/api/recommendations?date=2026-10-26").expect(200);
    expect(patient.body.every((r: { audience?: string }) => r.audience !== "clinician")).toBe(true);
    const insights = await request(app).get("/api/insights?date=2026-10-26").expect(200);
    expect(insights.body.triggers.length).toBeGreaterThan(0);
    expect(insights.body.cycleCorrelation.length).toBe(4);
    const report = await request(app).get("/api/report?date=2026-10-26").expect(200);
    expect(report.body.medications.length).toBe(3);
  });

  it("does not offer demo loading outside development sign-in", async () => {
    const { app } = await createApp({ storage: new MemStorage(), authMode: "none" });
    await request(app).post("/api/demo/load").expect(503);
  });

  it("deletes all of a user's data on request", async () => {
    const { app } = await devApp();
    await request(app).post("/api/attacks").send(attack).expect(201);
    await request(app).delete("/api/me/data").expect(204);
    expect((await request(app).get("/api/attacks")).body).toEqual([]);
  });
});

describe("ML export", () => {
  it("labels each day with whether an attack starts the next day, and never includes unfinished days", () => {
    const s = emptyState();
    s.dailyLogs = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((date) => ({ date, exposures: [], headache: false }));
    s.attacks = [{ ...attack, id: "a", start: "2026-10-03T09:00", painLocations: [], painQualities: [], symptoms: [], worsenedByActivity: false, triggers: [], alleviators: [], exacerbators: [], doses: [], disability: "mild", redFlags: [] }] as never;
    const rows = generateMLDataset(s, "2026-10-04");
    expect(rows.map((r) => [r.date, r.migraine_onset_next_day])).toEqual([
      ["2026-10-01", 0],
      ["2026-10-02", 1],
    ]);
  });
});

describe("wearables", () => {
  beforeEach(() => as("wear"));

  it("maps Open Wearables summaries to daily samples", () => {
    const samples = normalizeSummaries(
      [{ date: "2026-10-20", source: { provider: "oura" }, duration_minutes: 412, avg_hrv_rmssd_ms: 41 }],
      [{ date: "2026-10-20", source: { provider: "oura" }, resting_heart_rate_bpm: 58, recovery_score: 72, avg_hrv_rmssd_ms: 99 }],
      [{ date: "2026-10-20", source: { provider: "fitbit" }, steps: 8000 }],
    );
    const get = (m: string) => samples.find((s) => s.metric === m);
    expect(get("sleepMinutes")).toMatchObject({ value: 412, source: "oura" });
    expect(get("hrvRmssd")?.value).toBe(41);
    expect(get("restingHeartRate")?.value).toBe(58);
    expect(get("readinessScore")?.value).toBe(72);
    expect(get("steps")).toMatchObject({ value: 8000, source: "fitbit" });
  });

  it("connects through the gateway without exposing its API key", async () => {
    process.env.OPEN_WEARABLES_URL = "http://gateway.test";
    process.env.OPEN_WEARABLES_API_KEY = "secret-key";
    const calls: { url: string; key: string | null }[] = [];
    const fakeFetch = (async (url: URL, init?: RequestInit) => {
      calls.push({ url: url.toString(), key: new Headers(init?.headers).get("X-Open-Wearables-API-Key") });
      const body = url.pathname === "/api/v1/users" ? { id: "ow-user-1" } : { authorization_url: "https://cloud.ouraring.com/oauth/authorize?x=1", state: "s" };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    const { app } = await devApp(new MemStorage(), () => new OpenWearablesClient("http://gateway.test", "secret-key", fakeFetch));
    const res = await request(app).post("/api/wearables/connect").send({ provider: "oura" }).expect(200);
    expect(res.body.url).toContain("ouraring.com");
    expect(JSON.stringify(res.body)).not.toContain("secret-key");
    expect(calls.every((c) => c.key === "secret-key")).toBe(true);
    expect(calls[1].url).toContain("user_id=ow-user-1");
    delete process.env.OPEN_WEARABLES_URL;
    delete process.env.OPEN_WEARABLES_API_KEY;
  });

  it("imports CSV-derived samples", async () => {
    const { app } = await devApp();
    await request(app)
      .post("/api/wearables/import")
      .send({ source: "csv", samples: [{ date: "2026-10-20", metric: "sleepScore", value: 64 }] })
      .expect(200);
    const res = await request(app).get("/api/wearables/samples?days=30&date=2026-10-21").expect(200);
    expect(res.body).toHaveLength(1);
  });
});
