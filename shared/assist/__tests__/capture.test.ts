import { describe, expect, it } from "vitest";
import { parseCapture, resolveClock } from "../capture";
import { screenText } from "../safetyScreen";
import { sanitizeProposal } from "../sanitize";
import type { CaptureContext } from "../types";

const ctx: CaptureContext = {
  now: "2026-10-26T18:40",
  medications: [
    { id: "med-1", name: "Sumatriptan", cls: "triptan", role: "acute", active: true },
    { id: "med-2", name: "Acetaminophen + Aspirin + Caffeine", cls: "combination-analgesic", role: "acute", active: true },
    { id: "med-3", name: "Magnesium glycinate", cls: "other", role: "preventive", active: true },
  ],
  customTriggers: [{ id: "custom:night-shifts", label: "Night shifts" }],
  tracksCycle: true,
};

const EXAMPLE =
  "Bad migraine started around 2, right side, throbbing, felt sick and couldn't stand the light. Took my sumatriptan at 2:30, it took the edge off but it's still there. Didn't get lunch till almost 4 because of back-to-back meetings, slept terribly, and I had a shouting match with my brother this morning.";

describe("chat capture (basic mode)", () => {
  it("reads the worked example the way a person would", () => {
    const p = parseCapture(EXAMPLE, ctx);
    expect(p.screen.urgent).toBe(false);
    expect(p.attack).toMatchObject({
      start: "2026-10-26T14:00",
      painLocations: ["right"],
      painQualities: ["throbbing"],
      doses: [{ medicationId: "med-1", takenAt: "2026-10-26T14:30", reliefAt2h: "partial" }],
    });
    expect(p.attack!.symptoms).toEqual(expect.arrayContaining(["nausea", "photophobia"]));
    expect(p.attack!.triggers).toEqual(expect.arrayContaining(["late-meal", "poor-sleep", "conflict"]));
    expect(p.attack!.end).toBeUndefined();
    expect(p.checkIn).toMatchObject({ lunchTime: "15:50", headache: true });
    expect(p.heardButNotMapped).toContain("back-to-back meetings");
    const fields = p.questions.map((q) => q.field);
    // It asks rather than guessing the pain score or the long workday, and doesn't ask about the end ("still there").
    expect(fields).toContain("peakSeverity");
    expect(p.questions.find((q) => q.field === "confirmTrigger")?.triggerId).toBe("long-workday");
    expect(p.attack!.triggers).not.toContain("long-workday");
    expect(fields).not.toContain("end");
    expect(p.attack!.peakSeverity).toBeUndefined();
  });

  it("asks instead of inventing details for a vague message", () => {
    const p = parseCapture("bad head again 😩", ctx);
    expect(p.attack).not.toBeNull();
    expect(p.attack!.start).toBeUndefined();
    expect(p.attack!.peakSeverity).toBeUndefined();
    expect(p.questions.map((q) => q.field)).toEqual(expect.arrayContaining(["start", "peakSeverity"]));
  });

  it("resolves clock times to the most recent past occurrence", () => {
    expect(resolveClock(2, 0, undefined, "2026-10-26T18:40")).toBe("2026-10-26T14:00");
    expect(resolveClock(2, 0, undefined, "2026-10-26T08:00")).toBe("2026-10-26T02:00");
    expect(resolveClock(11, 0, undefined, "2026-10-26T08:00")).toBe("2026-10-25T23:00");
    expect(resolveClock(9, 0, "pm", "2026-10-26T08:00")).toBe("2026-10-25T21:00");
  });

  it("does not read durations or scores as times", () => {
    const p = parseCapture("slept about 5 hours, woke up with a migraine, 6/10", ctx);
    expect(p.attack!.start).toBe("2026-10-26T07:00");
    expect(p.attack!.peakSeverity).toBe(6);
    expect(p.checkIn).toMatchObject({ sleepHours: 5, exposures: ["poor-sleep"] });
  });

  it("only logs doses of the patient's own medicines", () => {
    const p = parseCapture("migraine at 3pm, took tylenol, had caffeine too", ctx);
    expect(p.attack!.doses).toEqual([]);
    expect(p.heardButNotMapped.join(" ")).toMatch(/Tylenol isn't on your medicines list/);
  });

  it("maps 'my triptan' to the patient's triptan", () => {
    const p = parseCapture("headache since 1pm, took my triptan at 1:30", ctx);
    expect(p.attack!.doses).toEqual([{ medicationId: "med-1", takenAt: "2026-10-26T13:30" }]);
  });

  it("doesn't treat the app's name as an aura, or water as alcohol", () => {
    const p = parseCapture("Aura, I have a migraine since 4pm, 5/10. I didn't drink enough water.", ctx);
    expect(p.attack!.symptoms).not.toContain("aura-visual");
    expect(p.attack!.triggers).toEqual(["dehydration"]);
  });

  it("picks up the patient's own named triggers, and life events to confirm", () => {
    const p = parseCapture("Started a new job, night shifts all week, working 11 hours a day", ctx);
    expect(p.attack).toBeNull();
    expect(p.checkIn).toMatchObject({ workHours: 11 });
    expect(p.checkIn!.exposures).toEqual(expect.arrayContaining(["long-workday", "custom:night-shifts"]));
    expect(p.lifeEvent).toMatchObject({ label: "Started a new job", kind: "work", date: "2026-10-26" });
    expect(p.questions.some((q) => q.field === "lifeEvent")).toBe(true);
  });

  it("leaves out the period trigger when cycle tracking doesn't apply", () => {
    expect(parseCapture("migraine at 2pm, my period started", { ...ctx, tracksCycle: false }).attack!.triggers).not.toContain("menstruation");
    expect(parseCapture("migraine at 2pm, my period started", ctx).attack!.triggers).toContain("menstruation");
  });
});

describe("safety screen", () => {
  const urgent = [
    "worst headache of my life",
    "it came on suddenly and it's excruciating",
    "my speech is slurred and my face is drooping",
    "I can't see out of one eye",
    "I have a fever and a stiff neck",
    "I hit my head this morning and now it hurts",
    "I passed out",
    "weakness on one side, I'm confused",
  ];
  it.each(urgent)("flags %s as urgent", (text) => {
    expect(screenText(text).urgent).toBe(true);
  });

  it("ignores negated mentions", () => {
    expect(screenText("usual migraine, no confusion, no fever, didn't pass out").urgent).toBe(false);
  });

  it("raises non-urgent warning signs for review", () => {
    const s = screenText("this one is not like my usual migraines and worse when I lie down");
    expect(s.urgent).toBe(false);
    expect(s.flags).toEqual(expect.arrayContaining(["pattern-change", "positional"]));
  });

  it("leaves an ordinary migraine message alone", () => {
    expect(screenText(EXAMPLE)).toEqual({ urgent: false, flags: [] });
  });
});

describe("sanitizing a proposal", () => {
  it("keeps only known ids, the patient's medicines and past times, and always applies the screen", () => {
    const screen = screenText("not my usual headache");
    const p = sanitizeProposal(
      {
        mode: "ai",
        screen: { urgent: false, flags: [] },
        attack: {
          start: "2026-10-26T14:00",
          end: "2026-10-27T09:00", // future
          peakSeverity: 14,
          symptoms: ["nausea", "made-up"],
          triggers: ["conflict", "aliens"],
          doses: [
            { medicationId: "med-1", takenAt: "2026-10-26T14:30" },
            { medicationId: "someone-elses", takenAt: "2026-10-26T14:30" },
          ],
          redFlags: [],
        },
        checkIn: { stress: 42, exposures: ["late-meal", "nope"] },
        checkInDate: "2026-10-26",
        lifeEvent: null,
        heardButNotMapped: [],
        questions: [{ id: "x", field: "confirmTrigger", ask: "?", triggerId: "aliens" }],
      },
      ctx,
      screen,
    );
    expect(p.attack!.symptoms).toEqual(["nausea"]);
    expect(p.attack!.triggers).toEqual(["conflict"]);
    expect(p.attack!.doses).toEqual([{ medicationId: "med-1", takenAt: "2026-10-26T14:30" }]);
    expect(p.attack!.end).toBeUndefined();
    expect(p.attack!.peakSeverity).toBeUndefined();
    expect(p.attack!.redFlags).toEqual(["pattern-change"]);
    expect(p.checkIn).toEqual({ exposures: ["late-meal"] });
    // The bad question is dropped and the missing pain score is asked.
    expect(p.questions.map((q) => q.field)).toEqual(["peakSeverity"]);
  });
});
