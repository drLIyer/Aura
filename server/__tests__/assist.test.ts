import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { MemStorage } from "../storage";
import { defaultAssistant } from "../routes";
import { RuleProvider } from "@shared/assist/ruleProvider";
import type { AssistProvider } from "@shared/assist/types";

process.env.NODE_ENV = "test";
delete process.env.ANTHROPIC_API_KEY;

const as = (user: string) => {
  process.env.AURA_DEV_USER_ID = user;
};

async function app(assistant?: AssistProvider, storage = new MemStorage()) {
  const { app } = await createApp({ storage, authMode: "dev", ...(assistant ? { assistant } : {}) });
  return { app, storage };
}

/** Records what reached the provider, so tests can prove what didn't. */
class SpyProvider extends RuleProvider {
  calls: string[] = [];
  override async capture(text: string, ctx: Parameters<RuleProvider["capture"]>[1]) {
    this.calls.push(text);
    return super.capture(text, ctx);
  }
  override async ask(q: string, ctx: Parameters<RuleProvider["ask"]>[1]) {
    this.calls.push(q);
    return super.ask(q, ctx);
  }
}

describe("assistant mode", () => {
  it("is basic mode without a key and AI mode with one", async () => {
    expect(defaultAssistant({}).mode).toBe("basic");
    expect(defaultAssistant({ ANTHROPIC_API_KEY: "  " }).mode).toBe("basic");
    expect(defaultAssistant({ ANTHROPIC_API_KEY: "sk-ant-test" }).mode).toBe("ai");
    const { app: a } = await app();
    as("alice");
    expect((await request(a).get("/api/assist/status")).body).toEqual({ ai: false });
  });
});

describe("chat capture", () => {
  it("proposes entries but never saves them", async () => {
    const { app: a } = await app();
    as("alice");
    await request(a).post("/api/medications").send({ name: "Sumatriptan", cls: "triptan", role: "acute" }).expect(201);
    const res = await request(a)
      .post("/api/assist/capture")
      .send({ text: "migraine started at 2pm, 7/10, took sumatriptan at 2:30, late lunch", now: "2026-10-26T18:40" })
      .expect(200);
    expect(res.body.attack).toMatchObject({ start: "2026-10-26T14:00", peakSeverity: 7 });
    expect(res.body.attack.doses).toHaveLength(1);
    expect((await request(a).get("/api/attacks")).body).toEqual([]);
    expect((await request(a).get("/api/checkins/2026-10-26")).body).toBeNull();
  });

  it("keeps urgent messages away from the provider and returns the emergency guidance", async () => {
    const spy = new SpyProvider();
    const { app: a } = await app(spy);
    as("alice");
    const res = await request(a).post("/api/assist/capture").send({ text: "worst headache of my life, came on suddenly", now: "2026-10-26T18:40" }).expect(200);
    expect(res.body.screen.urgent).toBe(true);
    expect(res.body.screen.message).toMatch(/emergency/);
    expect(res.body.attack.redFlags).toEqual(expect.arrayContaining(["worst-ever", "thunderclap"]));
    expect(spy.calls).toEqual([]);
    await request(a).post("/api/assist/capture").send({ text: "migraine since 3pm", now: "2026-10-26T18:40" }).expect(200);
    expect(spy.calls).toEqual(["migraine since 3pm"]);
  });

  it("only uses the signed-in user's medicines", async () => {
    const { app: a } = await app();
    as("bob");
    await request(a).post("/api/medications").send({ name: "Rizatriptan", cls: "triptan", role: "acute" }).expect(201);
    as("alice");
    const res = await request(a).post("/api/assist/capture").send({ text: "migraine at 1pm, took rizatriptan at 1:15", now: "2026-10-26T18:40" }).expect(200);
    expect(res.body.attack.doses).toEqual([]);
  });

  it("validates input", async () => {
    const { app: a } = await app();
    as("alice");
    await request(a).post("/api/assist/capture").send({ text: "" }).expect(400);
    await request(a).post("/api/assist/capture").send({ text: "x".repeat(5000) }).expect(400);
  });
});

describe("ask", () => {
  it("answers from the signed-in user's records with sources", async () => {
    const { app: a } = await app();
    as("alice");
    const res = await request(a).post("/api/assist/ask").send({ question: "How often am I getting migraines?" }).expect(200);
    expect(res.body.mode).toBe("basic");
    expect(res.body.blocks[0].text).toMatch(/^0 migraine days in the last 30 days/);
    expect(res.body.blocks[0].sources).toEqual([{ kind: "record", label: "Your attack log" }]);
  });

  it("answers an urgent question in basic mode with the emergency guidance", async () => {
    const spy = new SpyProvider();
    const { app: a } = await app(spy);
    as("alice");
    const res = await request(a).post("/api/assist/ask").send({ question: "is it normal that my face is drooping" }).expect(200);
    expect(res.body.screen.urgent).toBe(true);
    expect(spy.calls).toEqual([]);
  });
});
