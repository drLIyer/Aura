import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlockParam, BetaMessage, BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { ALLEVIATORS, EXACERBATORS, PAIN_LOCATIONS, PAIN_QUALITIES, RED_FLAGS, SYMPTOMS, TRIGGERS } from "@shared/engine/domain/catalog";
import { checkAnswer, guidelineDocs, recordDocs, type CitedBlock, type GroundingDoc } from "@shared/assist/grounding";
import { RuleProvider } from "@shared/assist/ruleProvider";
import { keepsNumbers } from "@shared/assist/watcher";
import { LIFE_EVENT_KINDS } from "@shared/assist/types";
import type { Answer, AssistContext, AssistProvider, CaptureContext, CaptureProposal, Note, PreVisitSummary, SummarySection } from "@shared/assist/types";

/**
 * AI mode. Used only when the server has ANTHROPIC_API_KEY; the key never leaves the server.
 * Claude does language only: it proposes log entries (which the patient confirms) and words
 * answers from documents Aura builds, with citations. Every result goes through the same
 * sanitising and checking as basic mode, and any failure falls back to basic mode.
 */

export const AI_MODEL = process.env.AURA_AI_MODEL || "claude-opus-5-5";
const BETAS = ["server-side-fallback-2026-07-01"];

/** The part of the SDK client this provider uses, so tests can pass a fake. */
export interface MessagesClient {
  beta: { messages: { create(params: Record<string, unknown>): Promise<BetaMessage> } };
}

const list = (items: { id: string; label: string }[]) => items.map((o) => `${o.id}: ${o.label}`).join("\n");

const CAPTURE_SYSTEM = `You turn what a person with migraine says or types into entries for Aura, a migraine diary. You only fill in fields; you never give medical advice.

Rules:
- Use only the ids in the lists below. If something they said doesn't fit a list, put a short phrase for it in heardButNotMapped.
- Never guess a number they didn't give (pain score, times, hours). Leave it null and add a question instead.
- Resolve times against "now" (local time). "around 2" means the most recent 2:00 that is not in the future. Output times as YYYY-MM-DDTHH:MM.
- Medicines: only use medicationId values from their medicines list. A medicine they mention that isn't on the list goes in heardButNotMapped.
- If something might be a trigger but you're not sure (e.g. "back-to-back meetings" might be a long workday), don't add it: ask with a confirmTrigger question naming the triggerId.
- Only propose an attack if they describe a headache or migraine. Daily facts (lunch time, sleep hours, work hours, stress 0-10, triggers present today) go in checkIn.
- A lasting change in their life (new job, travel, illness, new diet) goes in lifeEvent, with a lifeEvent question asking whether to add it.
- Questions are short and friendly, one thing each.

Pain locations:
${list(PAIN_LOCATIONS)}

Pain qualities:
${list(PAIN_QUALITIES)}

Symptoms:
${list(SYMPTOMS)}

Triggers:
${list(TRIGGERS)}

Things that helped (alleviators):
${list(ALLEVIATORS)}

Things that made it worse (exacerbators):
${list(EXACERBATORS)}

Warning signs (redFlags):
${list(RED_FLAGS)}`;

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const idArray = (items: { id: string }[]) => ({ type: "array", items: { type: "string", enum: items.map((o) => o.id) } });

function captureSchema(ctx: CaptureContext) {
  const triggerIds = [...TRIGGERS.map((t) => t.id).filter((id) => ctx.tracksCycle || id !== "menstruation"), ...ctx.customTriggers.map((c) => c.id)];
  const medIds = ctx.medications.filter((m) => m.active).map((m) => m.id);
  const time = nullable({ type: "string" });
  return {
    type: "object",
    additionalProperties: false,
    required: ["attack", "checkIn", "lifeEvent", "heardButNotMapped", "questions"],
    properties: {
      attack: nullable({
        type: "object",
        additionalProperties: false,
        required: ["start", "end", "peakSeverity", "painLocations", "painQualities", "symptoms", "triggers", "alleviators", "exacerbators", "worsenedByActivity", "doses", "disability", "redFlags"],
        properties: {
          start: time,
          end: time,
          peakSeverity: nullable({ type: "integer" }),
          painLocations: idArray(PAIN_LOCATIONS),
          painQualities: idArray(PAIN_QUALITIES),
          symptoms: idArray(SYMPTOMS),
          triggers: { type: "array", items: { type: "string", enum: triggerIds } },
          alleviators: idArray(ALLEVIATORS),
          exacerbators: idArray(EXACERBATORS),
          worsenedByActivity: nullable({ type: "boolean" }),
          doses: {
            type: "array",
            items: medIds.length
              ? {
                  type: "object",
                  additionalProperties: false,
                  required: ["medicationId", "takenAt", "reliefAt2h"],
                  properties: { medicationId: { type: "string", enum: medIds }, takenAt: time, reliefAt2h: nullable({ type: "string", enum: ["none", "partial", "pain-free"] }) },
                }
              : { type: "null" },
          },
          disability: nullable({ type: "string", enum: ["none", "mild", "moderate", "severe"] }),
          redFlags: idArray(RED_FLAGS),
        },
      }),
      checkIn: nullable({
        type: "object",
        additionalProperties: false,
        required: ["lunchTime", "sleepHours", "workHours", "stress", "exposures"],
        properties: {
          lunchTime: nullable({ type: "string" }),
          sleepHours: nullable({ type: "number" }),
          workHours: nullable({ type: "number" }),
          stress: nullable({ type: "integer" }),
          exposures: { type: "array", items: { type: "string", enum: triggerIds } },
        },
      }),
      lifeEvent: nullable({
        type: "object",
        additionalProperties: false,
        required: ["label", "kind"],
        properties: { label: { type: "string" }, kind: { type: "string", enum: [...LIFE_EVENT_KINDS] } },
      }),
      heardButNotMapped: { type: "array", items: { type: "string" } },
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["field", "ask", "triggerId", "medicationId"],
          properties: {
            field: { type: "string", enum: ["peakSeverity", "start", "end", "disability", "confirmTrigger", "doseTime", "lifeEvent"] },
            ask: { type: "string" },
            triggerId: nullable({ type: "string" }),
            medicationId: nullable({ type: "string" }),
          },
        },
      },
    },
  };
}

const ASK_SYSTEM = `You are Aura's assistant for a person with migraine. Answer ONLY from the documents provided: their own records (computed by Aura's engine) and guideline excerpts.

Rules:
- Every statement about their health, their data, medicines or treatment must be supported by a document and cited. If the documents don't answer the question, say exactly: "That isn't in your records or the guidelines Aura uses. Worth asking your clinician."
- Never diagnose, never suggest a new medicine or a dose, never say a medicine is safe for them. If "Aura's safety and guideline checks" flags something, repeat that flag; never contradict it.
- Use the numbers exactly as they appear in the documents. Don't calculate new ones.
- For warning signs of an emergency, tell them to get emergency care now.
- Be brief and warm: 2 to 5 short sentences, plain words, no headings.`;

const SUMMARY_SYSTEM = `You write a pre-visit summary of a migraine patient's records for their clinician. Use ONLY the documents provided and cite every statement. Use the numbers exactly as given; don't calculate new ones. Don't recommend treatment; list Aura's flags as flags.

Format: short sections, each starting with a line "## <heading>": Overview, Treatment, Patterns, Flags, Recent changes, To discuss. Leave out a section with nothing in it. Clinical, concise wording.`;

const PHRASE_SYSTEM = `Reword each note for a patient so it reads warmly and clearly. Keep every number exactly as written and don't add any fact, number or advice. Return the same ids.`;

const toDocParam = (d: GroundingDoc): BetaContentBlockParam => ({
  type: "document",
  source: { type: "text", media_type: "text/plain", data: d.text || "(none)" },
  title: d.title,
  citations: { enabled: true },
});

/** Text blocks with the documents each cites. Fallback, thinking and other blocks are ignored. */
function citedBlocks(msg: BetaMessage): CitedBlock[] {
  return msg.content.flatMap((b) =>
    b.type === "text" ? [{ text: b.text, cited: (b.citations ?? []).flatMap((c) => ("document_index" in c && typeof c.document_index === "number" ? [c.document_index] : [])) }] : [],
  );
}

function jsonOut<T>(msg: BetaMessage): T {
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return JSON.parse(text) as T;
}

const UNAVAILABLE = "AI wasn't available for this, so Aura used basic mode.";

export class ClaudeProvider implements AssistProvider {
  readonly mode = "ai" as const;
  private rules = new RuleProvider();
  private client: MessagesClient;

  constructor(client?: MessagesClient) {
    this.client = client ?? (new Anthropic() as unknown as MessagesClient);
  }

  private async create(params: Record<string, unknown>): Promise<BetaMessage> {
    const msg = await this.client.beta.messages.create({ model: AI_MODEL, betas: BETAS, fallbacks: "default", ...params });
    if (msg.stop_reason === "refusal") throw new Error("declined");
    if (msg.stop_reason === "max_tokens") throw new Error("truncated");
    return msg;
  }

  private warn(what: string, err: unknown) {
    const status = err instanceof Anthropic.APIError ? ` ${err.status}` : "";
    console.error(`[aura] AI ${what} fell back to basic mode:${status} ${(err as Error).message}`);
  }

  async capture(text: string, ctx: CaptureContext): Promise<CaptureProposal> {
    try {
      const msg = await this.create({
        max_tokens: 4000,
        output_config: { effort: "low", format: { type: "json_schema", schema: captureSchema(ctx) } },
        system: [{ type: "text", text: CAPTURE_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              now: ctx.now,
              medicines: ctx.medications.filter((m) => m.active).map((m) => ({ medicationId: m.id, name: m.name })),
              customTriggers: ctx.customTriggers,
              message: text,
            }),
          },
        ],
      });
      type Out = {
        attack: (Record<string, unknown> & { doses: ({ medicationId: string; takenAt: string | null; reliefAt2h: string | null } | null)[] }) | null;
        checkIn: Record<string, unknown> | null;
        lifeEvent: { label: string; kind: string } | null;
        heardButNotMapped: string[];
        questions: { field: string; ask: string; triggerId: string | null; medicationId: string | null }[];
      };
      const out = jsonOut<Out>(msg);
      const dropNulls = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null));
      return {
        mode: "ai",
        screen: { urgent: false, flags: [] },
        attack: out.attack
          ? ({
              ...dropNulls(out.attack),
              doses: out.attack.doses.filter((d): d is NonNullable<typeof d> => Boolean(d)).map((d) => dropNulls(d)),
              notes: text.slice(0, 4000),
            } as CaptureProposal["attack"])
          : null,
        checkIn: out.checkIn ? (dropNulls(out.checkIn) as CaptureProposal["checkIn"]) : null,
        checkInDate: ctx.now.slice(0, 10),
        lifeEvent: out.lifeEvent ? { date: ctx.now.slice(0, 10), label: out.lifeEvent.label, kind: out.lifeEvent.kind as never } : null,
        heardButNotMapped: out.heardButNotMapped,
        questions: out.questions.map((q, i) => ({
          id: `q${i}`,
          field: q.field as never,
          ask: q.ask,
          ...(q.triggerId ? { triggerId: q.triggerId } : {}),
          ...(q.medicationId ? { medicationId: q.medicationId } : {}),
        })),
      };
    } catch (err) {
      this.warn("capture", err);
      return { ...(await this.rules.capture(text, ctx)), notice: UNAVAILABLE };
    }
  }

  async ask(question: string, ctx: AssistContext): Promise<Answer> {
    try {
      const docs = [...guidelineDocs(ctx, question), ...recordDocs(ctx)];
      const audience = ctx.audience === "clinician" ? "The reader is their clinician: clinical wording is fine." : "The reader is the patient.";
      const msg = await this.create({
        max_tokens: 2000,
        output_config: { effort: "medium" },
        system: [{ type: "text", text: ASK_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: [...docs.map(toDocParam), { type: "text", text: `${audience}\nToday is ${ctx.today}.\n\nQuestion: ${question}` } satisfies BetaTextBlockParam] }],
      });
      const { blocks } = checkAnswer(citedBlocks(msg), docs, ctx);
      return { mode: "ai", blocks, suggestions: [], fallback: blocks.length === 1 && !blocks[0].sources.length };
    } catch (err) {
      this.warn("ask", err);
      return { ...(await this.rules.ask(question, ctx)), notice: UNAVAILABLE };
    }
  }

  async phraseNotes(notes: Note[]): Promise<Note[]> {
    if (!notes.length) return notes;
    try {
      const msg = await this.create({
        max_tokens: 3000,
        output_config: {
          effort: "low",
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["notes"],
              properties: { notes: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "text"], properties: { id: { type: "string" }, text: { type: "string" } } } } },
            },
          },
        },
        system: [{ type: "text", text: PHRASE_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: JSON.stringify(notes.map((n) => ({ id: n.id, text: n.text }))) }],
      });
      const out = new Map(jsonOut<{ notes: { id: string; text: string }[] }>(msg).notes.map((n) => [n.id, n.text]));
      // A rewording that changes, drops or adds a number is discarded.
      return notes.map((n) => {
        const t = out.get(n.id);
        return t && keepsNumbers(n.text, t) ? { ...n, text: t } : n;
      });
    } catch (err) {
      this.warn("notes", err);
      return notes;
    }
  }

  async summary(ctx: AssistContext): Promise<PreVisitSummary> {
    try {
      const docs = [...guidelineDocs(ctx, "summary prevention overuse acute treatment"), ...recordDocs(ctx)];
      const msg = await this.create({
        max_tokens: 4000,
        output_config: { effort: "medium" },
        system: [{ type: "text", text: SUMMARY_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: [...docs.map(toDocParam), { type: "text", text: `Write the pre-visit summary. Today is ${ctx.today}.` } satisfies BetaTextBlockParam] }],
      });
      // Split into sections at "## " heading lines, then check each section's sentences.
      const sections: { heading: string; blocks: CitedBlock[] }[] = [];
      for (const b of citedBlocks(msg)) {
        const parts = b.text.split(/(^|\n)#+\s*([^\n]+)\n?/);
        // split() yields: text, sep, heading, text, sep, heading, ...
        for (let i = 0; i < parts.length; i++) {
          if (i % 3 === 2) sections.push({ heading: parts[i].trim(), blocks: [] });
          else if (i % 3 === 0 && parts[i].trim()) {
            if (!sections.length) sections.push({ heading: "Summary", blocks: [] });
            sections[sections.length - 1].blocks.push({ text: parts[i], cited: b.cited });
          }
        }
      }
      const checked: SummarySection[] = sections
        .map((s) => ({ heading: s.heading, items: checkAnswer(s.blocks, docs, ctx).blocks.filter((x) => x.sources.length) }))
        .filter((s) => s.items.length);
      if (!checked.length) throw new Error("nothing grounded");
      return { mode: "ai", generatedFor: ctx.today, sections: checked };
    } catch (err) {
      this.warn("summary", err);
      return { ...(await this.rules.summary(ctx)), notice: UNAVAILABLE };
    }
  }
}
