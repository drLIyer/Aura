import { localDateTime } from "../api";
import { ALLEVIATORS, EXACERBATORS, PAIN_LOCATIONS, PAIN_QUALITIES, RED_FLAGS, SYMPTOMS, TRIGGERS } from "../engine/domain/catalog";
import { lifeEventInput } from "./types";
import type { AttackDraft, CaptureContext, CaptureProposal, CaptureQuestion, SafetyScreen } from "./types";

/**
 * Every proposal, from either provider, passes through here before it reaches the patient:
 * only known list items and the patient's own medicines survive, times must be well-formed and
 * not in the future, and the fixed safety screen's flags are always applied.
 */

const ids = (list: { id: string }[]) => new Set(list.map((o) => o.id));
const KNOWN = {
  painLocations: ids(PAIN_LOCATIONS),
  painQualities: ids(PAIN_QUALITIES),
  symptoms: ids(SYMPTOMS),
  alleviators: ids(ALLEVIATORS),
  exacerbators: ids(EXACERBATORS),
  redFlags: ids(RED_FLAGS),
};
const TRIGGER_IDS = ids(TRIGGERS);
const QUESTION_FIELDS = new Set(["peakSeverity", "start", "end", "disability", "confirmTrigger", "doseTime", "lifeEvent"]);

const okTime = (t: unknown, now: string): t is string => typeof t === "string" && localDateTime.safeParse(t).success && t.slice(0, 16) <= now;
const keep = (v: unknown, allowed: Set<string>) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.has(x)))] : []);

export function sanitizeProposal(p: CaptureProposal, ctx: CaptureContext, screen: SafetyScreen): CaptureProposal {
  const triggerOk = new Set([...TRIGGER_IDS, ...ctx.customTriggers.map((c) => c.id)]);
  if (!ctx.tracksCycle) triggerOk.delete("menstruation");
  const medIds = new Set(ctx.medications.map((m) => m.id));

  let attack: AttackDraft | null = null;
  if (p.attack) {
    const a = p.attack;
    const start = okTime(a.start, ctx.now) ? a.start.slice(0, 16) : undefined;
    const end = okTime(a.end, ctx.now) && (!start || a.end >= start) ? a.end.slice(0, 16) : undefined;
    const sev = typeof a.peakSeverity === "number" && a.peakSeverity >= 0 && a.peakSeverity <= 10 ? Math.round(a.peakSeverity) : undefined;
    attack = {
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(sev !== undefined ? { peakSeverity: sev } : {}),
      painLocations: keep(a.painLocations, KNOWN.painLocations),
      painQualities: keep(a.painQualities, KNOWN.painQualities),
      symptoms: keep(a.symptoms, KNOWN.symptoms),
      triggers: keep(a.triggers, triggerOk),
      alleviators: keep(a.alleviators, KNOWN.alleviators),
      exacerbators: keep(a.exacerbators, KNOWN.exacerbators),
      worsenedByActivity: a.worsenedByActivity === true || undefined,
      doses: (a.doses ?? [])
        .filter((d) => medIds.has(d.medicationId))
        .map((d) => ({
          medicationId: d.medicationId,
          takenAt: okTime(d.takenAt, ctx.now) ? d.takenAt.slice(0, 16) : (start ?? ""),
          ...(d.reliefAt2h && ["none", "partial", "pain-free"].includes(d.reliefAt2h) ? { reliefAt2h: d.reliefAt2h } : {}),
        })),
      ...(a.disability && ["none", "mild", "moderate", "severe"].includes(a.disability) ? { disability: a.disability } : {}),
      redFlags: [...new Set([...keep(a.redFlags, KNOWN.redFlags), ...screen.flags.filter((f) => KNOWN.redFlags.has(f))])],
      notes: typeof a.notes === "string" ? a.notes.slice(0, 4000) : undefined,
    };
  }

  let checkIn = p.checkIn;
  if (checkIn) {
    const c = checkIn;
    const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && v >= lo && v <= hi ? v : undefined);
    const fields = {
      ...(typeof c.lunchTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(c.lunchTime) ? { lunchTime: c.lunchTime } : {}),
      ...(num(c.sleepHours, 0, 24) !== undefined ? { sleepHours: c.sleepHours } : {}),
      ...(num(c.workHours, 0, 24) !== undefined ? { workHours: c.workHours } : {}),
      ...(num(c.stress, 0, 10) !== undefined ? { stress: Math.round(c.stress!) } : {}),
      ...(keep(c.exposures, triggerOk).length ? { exposures: keep(c.exposures, triggerOk) } : {}),
      ...(c.headache === true ? { headache: true } : {}),
    };
    checkIn = Object.keys(fields).length ? fields : null;
  }

  const lifeEvent = p.lifeEvent && lifeEventInput.safeParse(p.lifeEvent).success ? lifeEventInput.parse(p.lifeEvent) : null;
  const questions: CaptureQuestion[] = (p.questions ?? [])
    .filter((q) => QUESTION_FIELDS.has(q.field) && typeof q.ask === "string")
    .filter((q) => q.field !== "confirmTrigger" || (q.triggerId && triggerOk.has(q.triggerId)))
    .filter((q) => q.field !== "doseTime" || (q.medicationId && medIds.has(q.medicationId)))
    .filter((q) => q.field !== "lifeEvent" || lifeEvent)
    .map((q) => ({ id: String(q.id).slice(0, 60), field: q.field, ask: q.ask.slice(0, 300), ...(q.triggerId ? { triggerId: q.triggerId } : {}), ...(q.medicationId ? { medicationId: q.medicationId } : {}) }));

  // Essentials the patient hasn't given are always asked, whatever the provider returned.
  if (attack) {
    const has = (f: string) => questions.some((q) => q.field === f);
    if (attack.peakSeverity === undefined && !has("peakSeverity")) questions.unshift({ id: "severity", field: "peakSeverity", ask: "How bad was it at its worst, 0 to 10?" });
    if (!attack.start && !has("start")) questions.unshift({ id: "start", field: "start", ask: "When did it start?" });
  }

  return {
    mode: p.mode,
    screen,
    attack,
    checkIn,
    checkInDate: ctx.now.slice(0, 10),
    lifeEvent,
    heardButNotMapped: (p.heardButNotMapped ?? []).filter((s) => typeof s === "string").map((s) => s.slice(0, 200)).slice(0, 10),
    questions,
    ...(p.notice ? { notice: p.notice } : {}),
  };
}
