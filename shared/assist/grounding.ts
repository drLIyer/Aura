import { GUIDELINES } from "../engine/domain/guidelines";
import { excerptsFor, searchExcerpts } from "../engine/domain/guidelineExcerpts";
import { answerQuestion } from "./ask";
import type { AnswerBlock, AssistContext, SourceRef } from "./types";
import { FALLBACK_ANSWER } from "./types";

/**
 * Grounding for AI mode. The model only sees documents built here: the patient's records as
 * engine summaries, and guideline excerpts. Its answer comes back with citations into those
 * documents, and `checkAnswer` throws out anything uncited or anything that contradicts the
 * rules engine. The same checks would apply to any model.
 */

export interface GroundingDoc {
  title: string;
  text: string;
  source: SourceRef;
}

const ASK_TOPICS = [
  ["Forecast", "Why is my risk what it is today?"],
  ["Triggers", "What are my top triggers?"],
  ["Migraine frequency", "How often am I getting migraines?"],
  ["Acute medicine use", "Am I using too much medicine?"],
  ["What helps", "What helps my attacks most?"],
  ["Sleep score", "Does my sleep score matter?"],
  ["Cycle", "Is my cycle a factor?"],
] as const;

/** The patient's records, one document per topic, each built from the same engine numbers basic mode uses. */
export function recordDocs(ctx: AssistContext): GroundingDoc[] {
  const docs: GroundingDoc[] = [];
  const profileLines = [
    `Sex: ${ctx.profile.sex}${ctx.profile.age !== undefined ? `; age ${ctx.profile.age}` : ""}`,
    ctx.profile.pregnant ? "Pregnant or within 6 weeks of giving birth." : "Not pregnant.",
    ctx.profile.conditions.length ? `Health conditions: ${ctx.profile.conditions.join(", ")}.` : "No health conditions recorded.",
  ];
  docs.push({ title: "Your records: profile", text: profileLines.join("\n"), source: { kind: "record", label: "Health profile" } });
  const meds = ctx.medications.filter((m) => m.active);
  docs.push({
    title: "Your records: medicines",
    text: meds.length ? meds.map((m) => `${m.name} (${m.role}${m.dose ? `, ${m.dose}` : ""}${m.startDate ? `, since ${m.startDate}` : ""})`).join("\n") : "No medicines recorded.",
    source: { kind: "record", label: "Medicines list" },
  });
  for (const [title, q] of ASK_TOPICS) {
    if (title === "Cycle" && !ctx.tracksCycle) continue;
    const blocks = answerQuestion(q, ctx).blocks.filter((b) => b.sources.some((s) => s.kind === "record"));
    if (blocks.length) docs.push({ title: `Your records: ${title.toLowerCase()}`, text: blocks.map((b) => b.text).join("\n"), source: { kind: "record", label: title } });
  }
  if (ctx.recommendations.length) {
    docs.push({
      title: "Aura's safety and guideline checks",
      text: ctx.recommendations.map((r) => `[${r.severity}] ${r.title}: ${r.detail}`).join("\n"),
      source: { kind: "record", label: "Aura's checks" },
    });
  }
  if (ctx.notes.length) docs.push({ title: "Changes Aura noticed", text: ctx.notes.map((n) => `${n.title}: ${n.text}`).join("\n"), source: { kind: "record", label: "Aura noticed" } });
  if (ctx.lifeEvents.length) {
    docs.push({ title: "Life events", text: ctx.lifeEvents.map((e) => `${e.date}${e.endDate ? ` to ${e.endDate}` : ""}: ${e.label}`).join("\n"), source: { kind: "record", label: "Life events" } });
  }
  return docs;
}

/** Guideline documents relevant to a question, plus any the engine's own flags cite. */
export function guidelineDocs(ctx: AssistContext, question: string): GroundingDoc[] {
  const ids = new Set<string>([...searchExcerpts(question, 8).map((e) => e.guidelineId), ...ctx.recommendations.flatMap((r) => r.sources)]);
  if (ctx.profile.pregnant) ids.add("acog-2022-pregnancy-headache").add("fda-2020-nsaid-pregnancy");
  return [...ids]
    .map((id) => GUIDELINES.find((g) => g.id === id))
    .filter((g): g is (typeof GUIDELINES)[number] => Boolean(g))
    .sort((a, b) => a.id.localeCompare(b.id)) // stable order keeps the prompt cacheable
    .map((g) => ({ title: `${g.organization}: ${g.title}`, text: excerptsFor(g.id).map((e) => e.text).join("\n"), source: { kind: "guideline", id: g.id } }));
}

/** A model's text block with the documents it cited. */
export interface CitedBlock {
  text: string;
  cited: number[];
}

/** Sentences that make a health claim and so must carry a citation. */
const CLAIM = /\d|\b(mg|dose|take|taking|took|avoid|safe|risk|should|medicine|medication|trigger|attack|migraine|pregnan\w*|prevent\w*|overuse|limit|days?|sleep|period|cycle|triptan|nsaid|ibuprofen|acetaminophen|tylenol|doctor|clinician)\b/i;
const SAYS_OK = /\b(is safe|are safe|it'?s safe|is fine|are fine|it'?s fine|okay to|ok to|no problem|go ahead|you can take|fine to take)\b/i;
const NEGATED_OK = /\b(not safe|isn'?t safe|not fine|not okay|avoid|don'?t take|do not take)\b/i;

/**
 * Keeps only what the records or guidelines support:
 * - a block with a health claim and no citation is dropped;
 * - a block calling a medicine safe or fine is dropped if Aura's checks flag that medicine,
 *   and the flag itself is shown instead;
 * - if nothing grounded is left, the answer is the standard fallback.
 */
export function checkAnswer(blocks: CitedBlock[], docs: GroundingDoc[], ctx: AssistContext): { blocks: AnswerBlock[]; dropped: number } {
  const out: AnswerBlock[] = [];
  let dropped = 0;
  const flagged = ctx.recommendations.filter((r) => r.severity === "urgent" || r.severity === "warning");
  const medWords = ctx.medications.flatMap((m) => m.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4).map((w) => ({ w, name: m.name })));
  const extraMedWords = ["ibuprofen", "naproxen", "aspirin", "advil", "aleve", "motrin", "acetaminophen", "tylenol", "sumatriptan", "triptan", "opioid", "codeine", "tramadol", "butalbital"].map((w) => ({ w, name: w }));
  const shownFlags = new Set<string>();

  // Citations split text mid-sentence, so rebuild whole sentences before judging them.
  const sentences: { text: string; cited: Set<number> }[] = [];
  let buf = { text: "", cited: new Set<number>() };
  for (const b of blocks) {
    buf.text += b.text;
    for (const i of b.cited) buf.cited.add(i);
    if (/[.!?:]\s*$/.test(buf.text) || /\n\s*$/.test(buf.text)) {
      sentences.push(buf);
      buf = { text: "", cited: new Set() };
    }
  }
  if (buf.text.trim()) sentences.push(buf);

  for (const s of sentences) {
    const text = s.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const sources = [...new Map([...s.cited].filter((i) => docs[i]).map((i) => [JSON.stringify(docs[i].source), docs[i].source])).values()];
    if (!sources.length && CLAIM.test(text)) {
      dropped++;
      continue;
    }
    if (SAYS_OK.test(text) && !NEGATED_OK.test(text)) {
      const lower = text.toLowerCase();
      const meds = [...medWords, ...extraMedWords].filter(({ w }) => lower.includes(w));
      const conflicts = flagged.filter((r) => meds.some(({ w }) => `${r.title} ${r.detail}`.toLowerCase().includes(w)));
      if (conflicts.length) {
        dropped++;
        for (const r of conflicts) {
          if (shownFlags.has(r.id)) continue;
          shownFlags.add(r.id);
          out.push({ text: `${r.title}: ${r.detail}`, sources: r.sources.map((id) => ({ kind: "guideline", id })) });
        }
        continue;
      }
    }
    out.push({ text, sources });
  }
  if (!out.some((b) => b.sources.length)) return { blocks: [{ text: FALLBACK_ANSWER, sources: [] }], dropped };
  return { blocks: out, dropped };
}
