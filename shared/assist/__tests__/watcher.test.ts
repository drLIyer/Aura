import { describe, expect, it } from "vitest";
import { addDays } from "../../engine/domain/dates";
import type { AppState, Attack } from "../../engine/domain/types";
import { emptyState } from "../../engine/state";
import { demoState } from "../../engine/demo";
import { buildAssistContext } from "../context";
import { basicSummary } from "../summary";
import { detectChanges, keepsNumbers } from "../watcher";

const TODAY = "2026-10-26";

const attack = (date: string, extra: Partial<Attack> = {}): Attack => ({
  id: `a-${date}-${Math.random()}`,
  start: `${date}T10:00`,
  end: `${date}T16:00`,
  peakSeverity: 6,
  painLocations: [],
  painQualities: [],
  symptoms: [],
  worsenedByActivity: false,
  triggers: [],
  alleviators: [],
  exacerbators: [],
  doses: [],
  disability: "mild",
  redFlags: [],
  ...extra,
});

/** `days` of daily check-ins ending today, plus the given attacks. */
function stateWith(days: number, attacks: Attack[] = [], exposures: (date: string) => string[] = () => []): AppState {
  const s = emptyState();
  s.dailyLogs = Array.from({ length: days }, (_, i) => {
    const date = addDays(TODAY, -(days - 1 - i));
    return { date, exposures: exposures(date), headache: false };
  });
  s.attacks = attacks;
  return s;
}

const kinds = (s: AppState) => detectChanges(s, TODAY).map((n) => n.kind);

describe("Aura noticed", () => {
  it("compares migraine days before and after a new medicine, using the records' numbers", () => {
    const start = addDays(TODAY, -40);
    const before = [45, 50, 55, 60, 65, 70].map((d) => attack(addDays(TODAY, -d)));
    const after = [10, 20].map((d) => attack(addDays(TODAY, -d)));
    const s = stateWith(100, [...before, ...after]);
    s.medications = [{ id: "pro", name: "Propranolol", cls: "beta-blocker", role: "preventive", active: true, startDate: start }];
    const note = detectChanges(s, TODAY).find((n) => n.kind === "medication-started")!;
    expect(note.title).toBe("Since starting Propranolol");
    expect(note.text).toContain("went from 4.4 to 1.5 per 30 days");
  });

  it("mentions a medicine started in the last few weeks", () => {
    const s = stateWith(60);
    s.medications = [{ id: "m", name: "Magnesium", cls: "other", role: "preventive", active: true, startDate: addDays(TODAY, -5) }];
    expect(detectChanges(s, TODAY)[0]).toMatchObject({ kind: "medication-started", title: "New medicine: Magnesium" });
  });

  it("spots a trigger that is new in the logs", () => {
    const s = stateWith(90, [], (d) => (d >= addDays(TODAY, -5) ? ["travel"] : []));
    const note = detectChanges(s, TODAY).find((n) => n.kind === "new-trigger")!;
    expect(note.title).toBe("New in your logs: Travel");
    expect(note.text).toContain("on 6 days in the last 28 days");
  });

  it("spots a rise in migraine days, but not a month that is only above a quiet one", () => {
    const earlier = [35, 50, 65, 80].map((d) => attack(addDays(TODAY, -d)));
    const recent = [1, 3, 5, 8, 11, 14, 18, 22].map((d) => attack(addDays(TODAY, -d)));
    expect(kinds(stateWith(100, [...earlier, ...recent]))).toContain("frequency-up");
    // Last 30 days: 9; before that: 12 and 0. Fewer than last month, so not a rise.
    const twelve = Array.from({ length: 12 }, (_, i) => attack(addDays(TODAY, -(31 + i * 2))));
    const nine = Array.from({ length: 9 }, (_, i) => attack(addDays(TODAY, -(1 + i * 3))));
    expect(kinds(stateWith(100, [...twelve, ...nine]))).not.toContain("frequency-up");
  });

  it("flags a new kind of aura", () => {
    const s = stateWith(90, [attack(addDays(TODAY, -60), { symptoms: ["aura-visual"] }), attack(addDays(TODAY, -3), { symptoms: ["aura-sensory"] })]);
    const note = detectChanges(s, TODAY).find((n) => n.kind === "new-aura")!;
    expect(note.text).toMatch(/sensory aura/i);
    expect(note.sources).toContainEqual({ kind: "guideline", id: "cdc-us-mec" });
  });

  it("hides dismissed notes", () => {
    const s = stateWith(60);
    s.medications = [{ id: "m", name: "Magnesium", cls: "other", role: "preventive", active: true, startDate: addDays(TODAY, -5) }];
    expect(detectChanges(s, TODAY, ["medication-started:m"])).toEqual([]);
  });

  it("checks that a reworded note keeps every number", () => {
    expect(keepsNumbers("9 days, up from 4.5", "You had 9 days, up from 4.5.")).toBe(true);
    expect(keepsNumbers("9 days, up from 4.5", "You had 9 days, up from about 5.")).toBe(false);
    expect(keepsNumbers("9 days", "9 days in 30 days")).toBe(false);
  });
});

describe("pre-visit summary (basic mode)", () => {
  it("covers the visit's main points, each with its source", () => {
    const ctx = buildAssistContext(demoState(TODAY), TODAY, "clinician");
    const s = basicSummary(ctx);
    expect(s.sections.map((x) => x.heading)).toEqual(expect.arrayContaining(["Overview", "Treatment", "Patterns", "Flags"]));
    for (const sec of s.sections) for (const item of sec.items) expect(item.sources.length).toBeGreaterThan(0);
    expect(s.sections[0].items[0].text).toContain(`${ctx.monthlyMigraineDays[2]} migraine day`);
  });
});
