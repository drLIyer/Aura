import { evaluate } from "../engine/cds/engine";
import { migraineDays, summarize, windowEnding } from "../engine/cds/metrics";
import { frequency, menstrualPattern, primarySource, scoreBands, suggestThreshold, thresholdsFor, tracksMenstrualCycle } from "../engine/cds/patterns";
import { fitRiskModel, forecast } from "../engine/cds/riskModel";
import { medicationResponses, overuseStatus } from "../engine/cds/rules";
import { addDays } from "../engine/domain/dates";
import type { AppState, ISODate } from "../engine/domain/types";
import type { AssistContext, AssistMemory, CaptureContext, LocalDateTime } from "./types";
import { emptyMemory } from "./types";
import { detectChanges } from "./watcher";

/**
 * The only door between the patient's data and an assistant provider. Everything here is an
 * engine output; raw records never reach a model, so an answer can only rest on what the engine
 * has already worked out.
 */
export function buildAssistContext(state: AppState, today: ISODate, audience: "patient" | "clinician" = "patient", memory: AssistMemory = emptyMemory()): AssistContext {
  const model = fitRiskModel(state);
  const recs = evaluate(state, today);
  const t = thresholdsFor(state);
  const birthYear = state.profile.birthYear;
  return {
    today,
    audience,
    profile: {
      sex: state.profile.sex,
      age: birthYear ? Number(today.slice(0, 4)) - birthYear : undefined,
      pregnant: Boolean(state.profile.pregnant),
      conditions: state.profile.conditions,
    },
    tracksCycle: tracksMenstrualCycle(state.profile, Number(today.slice(0, 4))),
    medications: state.medications,
    forecast: forecast(state, today),
    summary30: summarize(state, windowEnding(today, 30)),
    summary90: summarize(state, windowEnding(today, 90)),
    monthlyMigraineDays: [2, 1, 0].map((k) => migraineDays(state.attacks, windowEnding(addDays(today, -30 * k), 30)).size) as [number, number, number],
    overuse: overuseStatus(state, today),
    triggers: [...model.weights.values()].filter((w) => w.exposedDays > 0 || state.patterns.triggers.some((p) => p.id === w.id)).sort((a, b) => b.rr - a.rr),
    medicationResponses: medicationResponses(state),
    alleviators: frequency(state, "alleviators"),
    menstrual: menstrualPattern(state),
    sleepScore: { bands: scoreBands(state, "sleepScore"), suggestion: suggestThreshold(state, "sleepScore"), threshold: t.lowSleepScore, source: primarySource(state, "sleepScore") ?? null },
    recommendations: audience === "clinician" ? recs : recs.filter((r) => (r.audience ?? "both") !== "clinician"),
    notes: detectChanges(state, today, memory.dismissedNotes),
    lifeEvents: memory.lifeEvents,
    loggedDays: model.loggedDays,
  };
}

export function buildCaptureContext(state: AppState, now: LocalDateTime): CaptureContext {
  return {
    now,
    medications: state.medications.map(({ id, name, cls, role, active }) => ({ id, name, cls, role, active })),
    customTriggers: state.patterns.customTriggers ?? [],
    tracksCycle: tracksMenstrualCycle(state.profile, Number(now.slice(0, 4))),
  };
}
