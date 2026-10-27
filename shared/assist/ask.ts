import { ALLEVIATORS, SUPPLEMENT_CATALOG, labelOf } from "../engine/domain/catalog";
import { searchExcerpts } from "../engine/domain/guidelineExcerpts";
import type { MedicationClass } from "../engine/domain/types";
import type { Answer, AnswerBlock, AssistContext, SourceRef } from "./types";
import { FALLBACK_ANSWER } from "./types";

/**
 * Basic-mode Ask: a fixed set of questions, each answered from engine numbers with its sources.
 * Wording is fixed; nothing is generated, so nothing can be made up.
 */

const rec = (label: string): SourceRef => ({ kind: "record", label });
const gl = (id: string): SourceRef => ({ kind: "guideline", id });
const pct = (p: number) => `${Math.round(p * 100)}%`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const times = (rr: number) => `${rr.toFixed(1)}×`;

export const CLASS_LABEL: Partial<Record<MedicationClass, string>> = {
  triptan: "triptans",
  ergot: "ergots",
  opioid: "opioids",
  "combination-analgesic": "combination painkillers",
  "simple-analgesic": "acetaminophen",
  nsaid: "anti-inflammatories (NSAIDs)",
  gepant: "gepants",
  ditan: "lasmiditan",
};

export const SUGGESTED_QUESTIONS = [
  "Why is my risk what it is today?",
  "What are my top triggers?",
  "How often am I getting migraines?",
  "Am I using too much medicine?",
  "What helps my attacks most?",
  "Does my sleep score matter?",
  "What should I tell my doctor?",
];

interface Intent {
  re: RegExp;
  answer: (ctx: AssistContext, q: string) => AnswerBlock[];
}

function forecastBlocks(ctx: AssistContext): AnswerBlock[] {
  const f = ctx.forecast;
  const blocks: AnswerBlock[] = [
    {
      text: `Your forecast for today and tomorrow is ${pct(f.probability)}, compared with your usual ${pct(f.baseRate)} (${f.level.replace("-", " ")}). It's based on ${plural(f.loggedDays, "logged day")}.`,
      sources: [rec("Today's forecast")],
    },
  ];
  const raising = f.contributors.filter((c) => c.rr >= 1.05);
  if (raising.length) {
    blocks.push({
      text: `What's raising it: ${raising.map((c) => `${c.label} (${times(c.rr)}, from your ${c.via})`).join("; ")}.`,
      sources: [rec("Today's forecast"), rec("Your trigger estimates")],
    });
  } else {
    blocks.push({ text: "Nothing in today's check-in or wearable data is pushing it above your usual level.", sources: [rec("Today's check-in")] });
  }
  if (f.missing.length) blocks.push({ text: `It would be more accurate with: ${f.missing.join(", ")}.`, sources: [rec("Today's check-in")] });
  return blocks;
}

function triggerBlocks(ctx: AssistContext): AnswerBlock[] {
  const top = ctx.triggers.filter((t) => t.rr > 1.05).slice(0, 5);
  if (!top.length) return [{ text: "No trigger stands out yet. Keep logging daily check-ins; triggers show up once there are a few weeks of data.", sources: [rec("Your trigger estimates")] }];
  return [
    {
      text: `Your strongest triggers right now: ${top
        .map((t) => `${t.label} ${times(t.rr)}${t.exposedDays ? ` (${plural(t.exposedDays, "day")} of your own data, ${Math.round(t.personalWeight * 100)}% of the estimate)` : " (from research and your answers so far)"}`)
        .join("; ")}.`,
      sources: [rec("Your trigger estimates"), gl("kelman-2007-triggers")],
    },
    {
      text: "Each estimate starts from research and what you told Aura, then shifts towards what your own logs show.",
      sources: [gl("pellegrino-2018-perceived")],
    },
  ];
}

function frequencyBlocks(ctx: AssistContext): AnswerBlock[] {
  const [m3, m2, m1] = ctx.monthlyMigraineDays;
  const s = ctx.summary30;
  const blocks: AnswerBlock[] = [
    {
      text: `${plural(s.migraineDays, "migraine day")} in the last 30 days (${plural(s.attacks, "attack")}, ${plural(s.headacheDays, "headache day")} in all). The two 30-day periods before had ${m2} and ${m3}. In the last 90 days: ${plural(ctx.summary90.migraineDays, "migraine day")}.`,
      sources: [rec("Your attack log")],
    },
  ];
  if (m1 >= 4 || s.moderateSevereDays >= 4) {
    blocks.push({
      text: "At 4 or more migraine days a month, guidelines say preventive treatment should be offered. Worth discussing with your clinician if you haven't already.",
      sources: [gl("aan-ahs-2026-prevention")],
    });
  }
  if (s.headacheDays >= 15) {
    blocks.push({ text: "15 or more headache days a month for over 3 months is the definition of chronic migraine. Please raise this with your clinician.", sources: [gl("ichd-3")] });
  }
  return blocks;
}

function overuseBlocks(ctx: AssistContext): AnswerBlock[] {
  const o = ctx.overuse;
  const used = o.byClass.filter((c) => c.days > 0);
  if (!used.length) return [{ text: "You haven't logged any acute medicine days in the last 30 days.", sources: [rec("Your attack log")] }];
  const lines = used.map((c) => `${CLASS_LABEL[c.cls] ?? c.cls}: ${plural(c.days, "day")} (limit ${c.threshold})`).join("; ");
  const blocks: AnswerBlock[] = [{ text: `Acute medicine in the last 30 days: ${lines}.`, sources: [rec("Your medicine doses"), gl("ichd-3-moh")] }];
  if (o.overused.length || o.multipleClassOveruse) {
    blocks.push({
      text: "That is at or over the level linked to medication-overuse headache. Don't stop anything suddenly on your own; talk to your clinician about a plan.",
      sources: [gl("ichd-3-moh"), gl("amf-moh")],
    });
  } else {
    blocks.push({ text: "That is under the overuse limits. Treating early in an attack, while pain is mild, tends to work best.", sources: [gl("ichd-3-moh"), gl("ahs-2021-consensus")] });
  }
  return blocks;
}

function helpsBlocks(ctx: AssistContext): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  const meds = ctx.medicationResponses.filter((r) => r.rated > 0);
  if (meds.length) {
    blocks.push({
      text: `How your medicines have worked at 2 hours: ${meds.map((r) => `${r.medication.name}: pain-free ${r.painFree} of ${r.rated}, partly better ${r.partial}`).join("; ")}.`,
      sources: [rec("Your medicine doses"), gl("ahs-2021-consensus")],
    });
  }
  const alle = ctx.alleviators.slice(0, 4);
  if (alle.length) blocks.push({ text: `What you most often say helps: ${alle.map((a) => `${labelOf(ALLEVIATORS, a.id).toLowerCase()} (${plural(a.count, "attack")})`).join(", ")}.`, sources: [rec("Your attack log")] });
  if (!blocks.length) blocks.push({ text: "Not enough rated attacks yet. When you log an attack, add how you felt 2 hours after each dose.", sources: [rec("Your attack log")] });
  return blocks;
}

function sleepBlocks(ctx: AssistContext): AnswerBlock[] {
  const s = ctx.sleepScore;
  const bands = s.bands.filter((b) => b.days > 0);
  if (!bands.length) return [{ text: "No sleep scores logged yet. Connect a wearable or add your sleep score in the daily check-in.", sources: [rec("Your wearable data")] }];
  const blocks: AnswerBlock[] = [
    {
      text: `Days followed by an attack, by sleep score${s.source ? ` (${s.source})` : ""}: ${bands.map((b) => `${b.label}: ${pct(b.attackRate)} of ${plural(b.days, "day")}`).join("; ")}.`,
      sources: [rec("Your wearable data"), rec("Your attack log")],
    },
  ];
  if (s.suggestion) {
    blocks.push({
      text: `In your data, a sleep score below ${s.suggestion.below} comes with ${times(s.suggestion.relativeRisk)} the risk of an attack. Aura currently counts below ${s.threshold} as low; you can change that on My patterns.`,
      sources: [rec("Your wearable data")],
    });
  }
  return blocks;
}

function cycleBlocks(ctx: AssistContext): AnswerBlock[] {
  if (!ctx.tracksCycle) return [{ text: "Cycle tracking isn't on for your profile, so Aura isn't looking at hormonal patterns.", sources: [rec("Health profile")] }];
  const m = ctx.menstrual;
  if (!m || m.cycles < 2) return [{ text: "Log at least 2 periods and Aura will check whether your attacks cluster around them.", sources: [rec("Your periods")] }];
  return [
    {
      text: `${m.attacksInWindow} of ${m.attacksTotal} attacks started between 2 days before and 3 days after a period began, in ${m.cyclesWithAttack} of ${m.cycles} cycles.${m.meetsCriteria ? ` That fits ${m.pure ? "pure menstrual" : "menstrually related"} migraine, which is worth discussing with your clinician.` : ""}`,
      sources: [rec("Your periods"), rec("Your attack log"), gl("ichd-3")],
    },
  ];
}

function doctorBlocks(ctx: AssistContext): AnswerBlock[] {
  const blocks = frequencyBlocks(ctx).slice(0, 1);
  const flagged = ctx.recommendations.filter((r) => r.severity === "urgent" || r.severity === "warning").slice(0, 4);
  if (flagged.length) blocks.push({ text: `Things Aura flagged: ${flagged.map((r) => r.title).join("; ")}.`, sources: [...new Set(flagged.flatMap((r) => r.sources))].map(gl) });
  blocks.push({ text: "The Doctor report page has the full summary, ready to print or show.", sources: [rec("Doctor report")] });
  return blocks;
}

/** What the evidence says about a supplement, from the catalog the supplement rules use. */
function supplementBlocks(ctx: AssistContext, q: string): AnswerBlock[] | null {
  const s = SUPPLEMENT_CATALOG.find((x) => q.includes(x.kind) || q.includes(x.label.toLowerCase().split(" (")[0]));
  if (!s) return null;
  const blocks: AnswerBlock[] = [{ text: `${s.label} for migraine prevention: ${s.evidence}${s.cautions ? ` ${s.cautions}` : ""}`, sources: [gl("aan-ahs-2012-complementary")] }];
  const flagged = ctx.recommendations.filter((r) => r.category === "supplement" && `${r.title} ${r.detail}`.toLowerCase().includes(s.kind));
  for (const r of flagged.slice(0, 2)) blocks.push({ text: `${r.title}: ${r.detail}`, sources: r.sources.map(gl) });
  if (ctx.profile.pregnant && s.avoidInPregnancy) blocks.push({ text: `${s.label} should be avoided in pregnancy.`, sources: [gl("aan-ahs-2012-complementary")] });
  blocks.push({ text: "Check with your clinician or pharmacist before starting a supplement, especially alongside other medicines.", sources: [rec("Your medicines and Aura's checks")] });
  return blocks;
}

/** "Can I take X", "is X safe": only ever restates what the engine already flagged. */
function medicineBlocks(ctx: AssistContext, q: string): AnswerBlock[] | null {
  const supplement = supplementBlocks(ctx, q);
  if (supplement) return supplement;
  const med = ctx.medications.find((m) => m.name.toLowerCase().split(/[^a-z]+/).some((w) => w.length >= 4 && q.includes(w)));
  const word = med?.name ?? q.match(/\b(ibuprofen|advil|motrin|naproxen|aleve|aspirin|tylenol|acetaminophen|paracetamol|sumatriptan|triptan|excedrin)\b/)?.[0];
  if (!word) return null;
  const key = word.toLowerCase().split(/[^a-z]+/)[0];
  const relevant = ctx.recommendations.filter((r) => `${r.title} ${r.detail}`.toLowerCase().includes(key) || (ctx.profile.pregnant && r.id.startsWith("pregnancy")));
  const blocks: AnswerBlock[] = relevant.slice(0, 3).map((r) => ({ text: `${r.title}: ${r.detail}`, sources: r.sources.map(gl) }));
  if (!blocks.length) {
    const excerpts = searchExcerpts(`${q} ${ctx.profile.pregnant ? "pregnancy" : ""}`, 2);
    blocks.push({
      text: `Aura hasn't flagged anything about ${word} in your records. That isn't the same as saying it's right for you: check with your clinician or pharmacist before changing how you take any medicine.`,
      sources: [rec("Your medicines and Aura's checks")],
    });
    for (const e of excerpts) blocks.push({ text: `${e.organization}: ${e.text}`, sources: [gl(e.guidelineId)] });
  }
  return blocks;
}

const INTENTS: Intent[] = [
  { re: /\b(risk|chance|forecast|likely|odds)\b/, answer: forecastBlocks },
  { re: /\b(overus\w*|rebound|too much (medicine|medication)|too many (pills|tablets|doses)|how many days.*(medicine|triptan|painkiller))\b/, answer: overuseBlocks },
  { re: /\b(trigger\w*|sets? (me|it|them) off|causes?|caused)\b/, answer: triggerBlocks },
  { re: /\b(how (often|many)|frequency|migraine days|more (migraines|attacks)|getting worse|chronic)\b/, answer: frequencyBlocks },
  { re: /\b(what helps|helps (most|me)|relief|works best|what works|alleviat\w*)\b/, answer: helpsBlocks },
  { re: /\b(sleep score|sleep|readiness|oura|fitbit|garmin|whoop|wearable)\b/, answer: sleepBlocks },
  { re: /\b(period|cycle|menstrua\w*|hormon\w*)\b/, answer: cycleBlocks },
  { re: /\b(doctor|clinician|appointment|visit|report|summary)\b/, answer: doctorBlocks },
];

export function answerQuestion(question: string, ctx: AssistContext): Answer {
  const q = question.toLowerCase().replace(/[’`]/g, "'");
  const med = /\b(can i|safe|okay|ok to|should i|allowed|does|do|is|works?|help)\b/.test(q) ? medicineBlocks(ctx, q) : null;
  if (med) return { mode: "basic", blocks: med, suggestions: [], fallback: false };
  const intent = INTENTS.find((i) => i.re.test(q));
  if (intent) return { mode: "basic", blocks: intent.answer(ctx, q), suggestions: SUGGESTED_QUESTIONS.filter((s) => !intent.re.test(s.toLowerCase())).slice(0, 3), fallback: false };
  const excerpts = searchExcerpts(q, 2);
  const blocks: AnswerBlock[] = [{ text: `In basic mode I can answer questions like: ${SUGGESTED_QUESTIONS.slice(0, 4).join(" · ")}`, sources: [] }];
  if (excerpts.length) blocks.unshift(...excerpts.map((e) => ({ text: `From the guidelines Aura uses (${e.organization}): ${e.text}`, sources: [gl(e.guidelineId)] })));
  else blocks.unshift({ text: FALLBACK_ANSWER, sources: [] });
  return { mode: "basic", blocks, suggestions: SUGGESTED_QUESTIONS, fallback: !excerpts.length };
}
