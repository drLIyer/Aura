import { describe, expect, it } from "vitest";
import request from "supertest";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { createApp } from "../app";
import { MemStorage } from "../storage";
import { AI_MODEL, ClaudeProvider, type MessagesClient } from "../assist/claudeProvider";
import { buildAssistContext } from "@shared/assist/context";
import { demoState } from "@shared/engine/demo";
import { FALLBACK_ANSWER, type Note } from "@shared/assist/types";

process.env.NODE_ENV = "test";

type Params = Record<string, unknown>;
type Doc = { type: string; title?: string };

/** A stand-in for the SDK client: records requests, answers with a scripted message. */
function fake(reply: (params: Params) => Partial<BetaMessage> | Error) {
  const calls: Params[] = [];
  const client: MessagesClient = {
    beta: {
      messages: {
        async create(params) {
          calls.push(params);
          const r = reply(params);
          if (r instanceof Error) throw r;
          return { id: "msg_1", type: "message", role: "assistant", model: AI_MODEL, stop_reason: "end_turn", content: [], ...r } as BetaMessage;
        },
      },
    },
  };
  return { client, calls };
}

const text = (t: string, docIndex?: number) => ({
  type: "text" as const,
  text: t,
  citations: docIndex === undefined ? null : [{ type: "char_location" as const, cited_text: "x", document_index: docIndex, document_title: null, start_char_index: 0, end_char_index: 1, file_id: null }],
});
const json = (o: unknown) => ({ content: [text(JSON.stringify(o))] });

const TODAY = "2026-10-26";
const ctx = buildAssistContext(demoState(TODAY), TODAY);
const docIndex = (params: Params, title: string) => ((params.messages as { content: Doc[] }[])[0].content as Doc[]).findIndex((d) => d.title === title);

describe("Claude provider", () => {
  it("sends a structured capture request with refusal fallbacks, and its output is sanitised", async () => {
    const { client, calls } = fake(() =>
      json({
        attack: {
          start: "2026-10-26T14:00",
          end: null,
          peakSeverity: 7,
          painLocations: ["right"],
          painQualities: ["throbbing"],
          symptoms: ["nausea"],
          triggers: ["late-meal", "not-a-trigger"],
          alleviators: [],
          exacerbators: [],
          worsenedByActivity: null,
          doses: [{ medicationId: "someone-elses-med", takenAt: "2026-10-26T14:30", reliefAt2h: "partial" }],
          disability: null,
          redFlags: [],
        },
        checkIn: { lunchTime: "15:50", sleepHours: null, workHours: null, stress: null, exposures: ["late-meal"] },
        lifeEvent: null,
        heardButNotMapped: ["back-to-back meetings"],
        questions: [{ field: "confirmTrigger", ask: "Was it a long workday?", triggerId: "long-workday", medicationId: null }],
      }),
    );
    const { app } = await createApp({ storage: new MemStorage(), authMode: "dev", assistant: new ClaudeProvider(client) });
    process.env.AURA_DEV_USER_ID = "alice";
    const res = await request(app).post("/api/assist/capture").send({ text: "migraine since 2, late lunch", now: "2026-10-26T18:40" }).expect(200);

    const p = calls[0];
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.fallbacks).toBe("default");
    expect(p.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(p.output_config).toMatchObject({ effort: "low", format: { type: "json_schema" } });
    expect((p.system as { cache_control?: unknown }[])[0].cache_control).toEqual({ type: "ephemeral" });
    expect(JSON.stringify(p)).not.toMatch(/sk-ant/);

    expect(res.body.mode).toBe("ai");
    expect(res.body.attack.triggers).toEqual(["late-meal"]);
    expect(res.body.attack.doses).toEqual([]);
    expect(res.body.questions.map((q: { field: string }) => q.field)).toEqual(["confirmTrigger"]);
    expect((await request(app).get("/api/attacks")).body).toEqual([]);
  });

  it("answers only with cited statements", async () => {
    const { client, calls } = fake((params) => ({
      content: [
        text("Your strongest trigger is "),
        text("an argument or conflict (1.9×).", docIndex(params, "Your records: triggers")),
        text(" Also, drink two litres of water a day."),
      ],
    }));
    const a = await new ClaudeProvider(client).ask("What are my top triggers?", ctx);
    expect(a.mode).toBe("ai");
    expect(a.blocks).toEqual([{ text: "Your strongest trigger is an argument or conflict (1.9×).", sources: [{ kind: "record", label: "Triggers" }] }]);
    const docs = (calls[0].messages as { content: Doc[] }[])[0].content.filter((c) => c.type === "document");
    expect(docs.length).toBeGreaterThan(3);
    expect(docs.every((d) => (d as { citations?: { enabled: boolean } }).citations?.enabled)).toBe(true);
  });

  it("falls back to the standard answer when nothing is grounded", async () => {
    const { client } = fake(() => ({ content: [text("Migraines are caused by many things.")] }));
    const a = await new ClaudeProvider(client).ask("why do I get migraines", ctx);
    expect(a.blocks).toEqual([{ text: FALLBACK_ANSWER, sources: [] }]);
    expect(a.fallback).toBe(true);
  });

  it("uses basic mode when Claude declines or the request fails", async () => {
    const declined = await new ClaudeProvider(fake(() => ({ stop_reason: "refusal", content: [] })).client).ask("What are my top triggers?", ctx);
    expect(declined.mode).toBe("basic");
    expect(declined.notice).toMatch(/basic mode/);
    const failed = await new ClaudeProvider(fake(() => new Error("network down")).client).capture("migraine since 2pm", {
      now: "2026-10-26T18:40",
      medications: [],
      customTriggers: [],
      tracksCycle: true,
    });
    expect(failed.mode).toBe("basic");
    expect(failed.attack?.start).toBe("2026-10-26T14:00");
  });

  it("keeps a reworded note only if every number survives", async () => {
    const notes: Note[] = [
      { id: "a", kind: "frequency-up", date: TODAY, title: "t", text: "9 migraine days in the last 30 days.", sources: [] },
      { id: "b", kind: "frequency-up", date: TODAY, title: "t", text: "Logged on 6 days, compared with 1.5 before.", sources: [] },
    ];
    const { client } = fake(() =>
      json({
        notes: [
          { id: "a", text: "You had 9 migraine days over the last 30 days." },
          { id: "b", text: "Logged on 6 days, up from about 2 before." },
        ],
      }),
    );
    const out = await new ClaudeProvider(client).phraseNotes(notes);
    expect(out[0].text).toBe("You had 9 migraine days over the last 30 days.");
    expect(out[1].text).toBe(notes[1].text);
  });

  it("writes a sectioned, cited pre-visit summary", async () => {
    const { client } = fake((params) => {
      const freq = docIndex(params, "Your records: migraine frequency");
      return { content: [text("## Overview\n"), text("9 migraine days in the last 30 days.", freq), text("\n## Flags\nNothing else to add.")] };
    });
    const s = await new ClaudeProvider(client).summary(ctx);
    expect(s.mode).toBe("ai");
    expect(s.sections).toEqual([{ heading: "Overview", items: [{ text: "9 migraine days in the last 30 days.", sources: [{ kind: "record", label: "Migraine frequency" }] }] }]);
  });
});
