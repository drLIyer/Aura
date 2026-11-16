import { migraineDays, windowEnding } from "../engine/cds/metrics";
import { exposuresByLog } from "../engine/cds/patterns";
import { triggerLabel } from "../engine/cds/riskModel";
import { AURA_SYMPTOMS, SYMPTOMS, labelOf } from "../engine/domain/catalog";
import { addDays, daysBetween, formatDate } from "../engine/domain/dates";
import type { AppState, ISODate } from "../engine/domain/types";
import type { Note } from "./types";

/**
 * "Aura noticed": changes worth a second look, found with fixed rules over the patient's own
 * records. Every number here comes from the records; a provider may reword a note but the
 * caller checks that every number survives.
 */

const RECENT = 28;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const per30 = (days: number, span: number) => Math.round((days / span) * 30 * 10) / 10;

function medicationNotes(state: AppState, today: ISODate): Note[] {
  const out: Note[] = [];
  for (const m of state.medications) {
    if (m.startDate && m.startDate <= today && daysBetween(m.startDate, today) <= 90 && m.active) {
      const since = daysBetween(m.startDate, today) + 1;
      const record = { kind: "record" as const, label: `Medicines: ${m.name}, started ${formatDate(m.startDate)}` };
      if (since >= 21) {
        // Same-length windows before and after the start, capped at 60 days.
        const span = Math.min(since, 60);
        const after = migraineDays(state.attacks, { from: addDays(m.startDate, since - span), to: today }).size;
        const before = migraineDays(state.attacks, windowEnding(addDays(m.startDate, -1), span)).size;
        const a = per30(after, span);
        const b = per30(before, span);
        out.push({
          id: `medication-started:${m.id}`,
          kind: "medication-started",
          date: m.startDate,
          title: `Since starting ${m.name}`,
          text: `You started ${m.name} ${plural(since, "day")} ago. Migraine days went from ${b} to ${a} per 30 days (the ${plural(span, "day")} before vs since). Prevention can take 2–3 months to show its full effect, so keep logging.`,
          sources: [record, { kind: "record", label: "Your attack log" }],
        });
      } else if (since <= RECENT) {
        out.push({
          id: `medication-started:${m.id}`,
          kind: "medication-started",
          date: m.startDate,
          title: `New medicine: ${m.name}`,
          text: `You started ${m.name} ${plural(since, "day")} ago. Aura will compare your migraine days before and after once there are 3 weeks of data.`,
          sources: [record],
        });
      }
    }
    if (!m.active && m.endDate && m.endDate <= today && daysBetween(m.endDate, today) <= RECENT) {
      out.push({
        id: `medication-stopped:${m.id}`,
        kind: "medication-stopped",
        date: m.endDate,
        title: `Stopped ${m.name}`,
        text: `You stopped ${m.name} ${plural(daysBetween(m.endDate, today), "day")} ago. Aura will watch whether your migraine days change.`,
        sources: [{ kind: "record", label: `Medicines: ${m.name}, stopped ${formatDate(m.endDate)}` }],
      });
    }
  }
  return out;
}

/** Days each trigger was present, from check-ins and attack forms, with the first day seen. */
function triggerDays(state: AppState): Map<string, ISODate[]> {
  const days = new Map<string, Set<ISODate>>();
  const add = (id: string, d: ISODate) => days.set(id, (days.get(id) ?? new Set()).add(d));
  for (const [d, ex] of exposuresByLog(state)) for (const id of ex) add(id, d);
  for (const a of state.attacks) for (const id of a.triggers) add(id, a.start.slice(0, 10));
  return new Map([...days].map(([id, s]) => [id, [...s].sort()]));
}

function triggerNotes(state: AppState, today: ISODate): Note[] {
  const out: Note[] = [];
  const recentFrom = addDays(today, -(RECENT - 1));
  const priorFrom = addDays(today, -(RECENT * 3 - 1));
  for (const [id, days] of triggerDays(state)) {
    if (id === "menstruation" || id === "low-sleep-score" || id === "low-readiness") continue;
    const recent = days.filter((d) => d >= recentFrom && d <= today).length;
    const prior = days.filter((d) => d >= priorFrom && d < recentFrom).length;
    const label = triggerLabel(state, id);
    const first = days[0];
    const hasHistory = state.dailyLogs.some((l) => l.date < recentFrom);
    if (first >= recentFrom && hasHistory) {
      out.push({
        id: `new-trigger:${id}:${first}`,
        kind: "new-trigger",
        date: first,
        title: `New in your logs: ${label}`,
        text: `“${label}” showed up for the first time on ${formatDate(first)}, and on ${plural(recent, "day")} in the last ${RECENT} days. Aura is now tracking whether it comes before your attacks.`,
        sources: [{ kind: "record", label: "Your check-ins and attack log" }],
      });
    } else if (recent >= 4 && hasHistory && recent >= prior && recent - prior / 2 >= 3) {
      // At least double the earlier rate (prior covers two 28-day periods) and 3 more days.
      const priorAvg = Math.round((prior / 2) * 10) / 10;
      out.push({
        id: `rising-trigger:${id}:${recentFrom}`,
        kind: "rising-trigger",
        date: today,
        title: `More often lately: ${label}`,
        text: `“${label}” was logged on ${plural(recent, "day")} in the last ${RECENT} days, compared with about ${priorAvg} per ${RECENT} days before that.`,
        sources: [{ kind: "record", label: "Your check-ins and attack log" }],
      });
    }
  }
  return out;
}

function frequencyNote(state: AppState, today: ISODate): Note[] {
  const recent = migraineDays(state.attacks, windowEnding(today, 30)).size;
  const prior = [1, 2].map((k) => migraineDays(state.attacks, windowEnding(addDays(today, -30 * k), 30)).size);
  const loggedSince = state.dailyLogs.map((l) => l.date).sort()[0];
  if (!loggedSince || daysBetween(loggedSince, today) < 89) return [];
  // A real shift beats both earlier periods, not just their average (one quiet month shouldn't make a normal one look high).
  const avg = (prior[0] + prior[1]) / 2;
  const up = recent - Math.max(...prior) >= 2 && recent - avg >= 3 && (avg === 0 || recent / avg >= 1.5);
  const down = Math.min(...prior) - recent >= 2 && avg - recent >= 3 && recent / avg <= 0.5;
  if (!up && !down) return [];
  return [
    {
      id: `frequency-${up ? "up" : "down"}:${today.slice(0, 7)}`,
      kind: up ? "frequency-up" : "frequency-down",
      date: today,
      title: up ? "More migraine days this month" : "Fewer migraine days this month",
      text: `${plural(recent, "migraine day")} in the last 30 days, compared with ${prior[0]} and ${prior[1]} in the two 30-day periods before.${up ? " Worth a look at what changed, and worth mentioning to your clinician." : ""}`,
      sources: [{ kind: "record", label: "Your attack log" }],
    },
  ];
}

function auraNotes(state: AppState, today: ISODate): Note[] {
  const recentFrom = addDays(today, -(RECENT - 1));
  const seenBefore = new Set(state.attacks.filter((a) => a.start.slice(0, 10) < recentFrom).flatMap((a) => a.symptoms.filter((s) => AURA_SYMPTOMS.includes(s))));
  const hasEarlier = state.attacks.some((a) => a.start.slice(0, 10) < recentFrom);
  const out: Note[] = [];
  for (const a of state.attacks.filter((x) => x.start.slice(0, 10) >= recentFrom)) {
    for (const s of a.symptoms.filter((x) => AURA_SYMPTOMS.includes(x) && !seenBefore.has(x))) {
      if (!hasEarlier || out.some((n) => n.id.startsWith(`new-aura:${s}`))) continue;
      out.push({
        id: `new-aura:${s}:${a.start.slice(0, 10)}`,
        kind: "new-aura",
        date: a.start.slice(0, 10),
        title: "A new kind of aura",
        text: `On ${formatDate(a.start.slice(0, 10))} you logged ${labelOf(SYMPTOMS, s).toLowerCase()} for the first time. A change in your aura is worth telling your clinician about, especially before starting estrogen-containing contraception.`,
        sources: [{ kind: "record", label: "Your attack log" }, { kind: "guideline", id: "cdc-us-mec" }],
      });
    }
  }
  return out;
}

function pregnancyNote(state: AppState, today: ISODate): Note[] {
  if (!state.profile.pregnant) return [];
  return [
    {
      id: "pregnancy:on",
      kind: "pregnancy",
      date: today,
      title: "Pregnancy guidance is on",
      text: "Your profile says you are pregnant or gave birth in the last 6 weeks, so period tracking is paused and medicine advice follows pregnancy guidance. Untick it in Health profile when that changes.",
      sources: [{ kind: "record", label: "Health profile" }, { kind: "guideline", id: "acog-2022-pregnancy-headache" }],
    },
  ];
}

export function detectChanges(state: AppState, today: ISODate, dismissed: string[] = []): Note[] {
  const skip = new Set(dismissed);
  return [...pregnancyNote(state, today), ...auraNotes(state, today), ...frequencyNote(state, today), ...medicationNotes(state, today), ...triggerNotes(state, today)]
    .filter((n) => !skip.has(n.id))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Every number in a note, so a reworded version can be checked against the original. */
export const numbersIn = (text: string) => (text.match(/\d+(?:\.\d+)?/g) ?? []).sort();
export const keepsNumbers = (original: string, reworded: string) => {
  const a = numbersIn(original);
  const b = numbersIn(reworded);
  return a.length === b.length && a.every((n, i) => n === b[i]);
};
