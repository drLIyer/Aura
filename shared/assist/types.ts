import { z } from "zod";
import type { AttackInput, DailyLogInput } from "../api";
import type { Forecast, TriggerWeight } from "../engine/cds/riskModel";
import type { SummaryStats } from "../engine/cds/metrics";
import type { MedicationResponse, OveruseStatus } from "../engine/cds/rules";
import type { FrequencyItem, MenstrualPattern, ScoreBand, ThresholdSuggestion } from "../engine/cds/patterns";
import type { ISODate, Medication, Recommendation } from "../engine/domain/types";

/**
 * The ambient assistant ("Talk to Aura"). Two interchangeable providers implement it:
 * a deterministic rule-based one that always works (basic mode), and Claude, used only when the
 * server has an ANTHROPIC_API_KEY (AI mode). Both read the same context, built from the engine,
 * and both answers go through the same checks, so switching modes never changes what is safe.
 */

/** "YYYY-MM-DDTHH:MM" in the user's own time zone. */
export type LocalDateTime = string;

// ---------------------------------------------------------------- Memory (stored on the profile)

export const LIFE_EVENT_KINDS = ["work", "travel", "illness", "family", "sleep", "diet", "exercise", "other"] as const;

export const lifeEventInput = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    label: z.string().trim().min(1).max(120),
    kind: z.enum(LIFE_EVENT_KINDS).default("other"),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((e) => !e.endDate || e.endDate >= e.date, { message: "End date must be on or after the start date", path: ["endDate"] });
export type LifeEventInput = z.infer<typeof lifeEventInput>;
export interface LifeEvent extends LifeEventInput {
  id: string;
}

export interface AssistMemory {
  lifeEvents: LifeEvent[];
  /** Ids of "Aura noticed" notes the user has dismissed. */
  dismissedNotes: string[];
}
export const emptyMemory = (): AssistMemory => ({ lifeEvents: [], dismissedNotes: [] });

// ---------------------------------------------------------------- Safety screen

export interface SafetyScreen {
  /** True when any phrase calls for emergency care now. */
  urgent: boolean;
  /** RED_FLAGS ids heard in the text. */
  flags: string[];
  /** What the patient should do, in plain words. Present when urgent. */
  message?: string;
}

// ---------------------------------------------------------------- Capture ("log it")

export type QuestionField = "peakSeverity" | "start" | "end" | "disability" | "confirmTrigger" | "doseTime" | "lifeEvent";

export interface CaptureQuestion {
  id: string;
  field: QuestionField;
  ask: string;
  /** confirmTrigger: the trigger to add on "yes". */
  triggerId?: string;
  /** doseTime: which dose. */
  medicationId?: string;
}

/** A proposed attack. Same shape as the attack form, with the fields the patient hasn't given left empty. */
export type AttackDraft = Partial<Omit<AttackInput, "start">> & { start?: LocalDateTime };

export interface CaptureProposal {
  mode: "basic" | "ai";
  screen: SafetyScreen;
  attack: AttackDraft | null;
  /** Fields to merge into the check-in for `checkInDate`. */
  checkIn: Partial<DailyLogInput> | null;
  checkInDate: ISODate;
  lifeEvent: LifeEventInput | null;
  /** Things the patient said that Aura could not place in a field. */
  heardButNotMapped: string[];
  questions: CaptureQuestion[];
  /** Shown when AI mode fell back to basic mode for this request. */
  notice?: string;
}

export interface CaptureContext {
  now: LocalDateTime;
  medications: Pick<Medication, "id" | "name" | "cls" | "role" | "active">[];
  customTriggers: { id: string; label: string }[];
  tracksCycle: boolean;
}

// ---------------------------------------------------------------- Ask and grounding

/** Where a statement came from: the patient's own records, or a guideline in the registry. */
export type SourceRef = { kind: "record"; label: string } | { kind: "guideline"; id: string };

export interface AnswerBlock {
  text: string;
  sources: SourceRef[];
}

export interface Answer {
  mode: "basic" | "ai";
  blocks: AnswerBlock[];
  /** Questions basic mode can answer, offered as chips. */
  suggestions: string[];
  /** True when Aura had nothing grounded to say. */
  fallback: boolean;
  notice?: string;
}

export const FALLBACK_ANSWER = "That isn't in your records or the guidelines Aura uses. Worth asking your clinician.";

/** Everything the assistant may use, computed by the engine. Nothing else reaches a provider. */
export interface AssistContext {
  today: ISODate;
  audience: "patient" | "clinician";
  profile: { sex: string; age?: number; pregnant: boolean; conditions: string[] };
  tracksCycle: boolean;
  medications: Medication[];
  forecast: Forecast;
  summary30: SummaryStats;
  summary90: SummaryStats;
  /** Migraine days in each of the last three 30-day windows, oldest first. */
  monthlyMigraineDays: [number, number, number];
  overuse: OveruseStatus;
  triggers: TriggerWeight[];
  medicationResponses: MedicationResponse[];
  alleviators: FrequencyItem[];
  menstrual: MenstrualPattern | null;
  sleepScore: { bands: ScoreBand[]; suggestion: ThresholdSuggestion | null; threshold: number; source: string | null };
  recommendations: Recommendation[];
  notes: Note[];
  lifeEvents: LifeEvent[];
  loggedDays: number;
}

// ---------------------------------------------------------------- Watcher ("Aura noticed")

export type NoteKind = "medication-started" | "medication-stopped" | "new-trigger" | "rising-trigger" | "frequency-up" | "frequency-down" | "new-aura" | "pregnancy";

export interface Note {
  /** Stable, so a dismissal sticks: e.g. "medication-started:<id>". */
  id: string;
  kind: NoteKind;
  date: ISODate;
  title: string;
  text: string;
  sources: SourceRef[];
}

// ---------------------------------------------------------------- Pre-visit summary

export interface SummarySection {
  heading: string;
  items: AnswerBlock[];
}
export interface PreVisitSummary {
  mode: "basic" | "ai";
  generatedFor: ISODate;
  sections: SummarySection[];
  notice?: string;
}

// ---------------------------------------------------------------- Provider

export interface AssistProvider {
  readonly mode: "basic" | "ai";
  capture(text: string, ctx: CaptureContext): Promise<CaptureProposal>;
  ask(question: string, ctx: AssistContext): Promise<Answer>;
  /** Rewords notes. Must keep every number; the caller checks. */
  phraseNotes(notes: Note[]): Promise<Note[]>;
  summary(ctx: AssistContext): Promise<PreVisitSummary>;
}
