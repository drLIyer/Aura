import { formatDate } from "../engine/domain/dates";
import { CLASS_LABEL } from "./ask";
import type { AnswerBlock, AssistContext, PreVisitSummary, SourceRef } from "./types";

/** Basic-mode pre-visit summary: a fixed layout filled from engine outputs, for the clinician. */

const rec = (label: string): SourceRef => ({ kind: "record", label });
const gl = (id: string): SourceRef => ({ kind: "guideline", id });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function basicSummary(ctx: AssistContext): PreVisitSummary {
  const s30 = ctx.summary30;
  const [m3, m2, m1] = ctx.monthlyMigraineDays;
  const overview: AnswerBlock[] = [
    {
      text: `${plural(m1, "migraine day")} in the last 30 days (previous two 30-day periods: ${m2}, ${m3}); ${plural(s30.headacheDays, "headache day")} in all, ${plural(s30.moderateSevereDays, "moderate-to-severe day")}${s30.meanSeverity !== null ? `, mean peak pain ${s30.meanSeverity.toFixed(1)}/10` : ""}.`,
      sources: [rec("Attack log")],
    },
  ];
  if (ctx.profile.pregnant) overview.push({ text: "Pregnant or within 6 weeks of giving birth.", sources: [rec("Health profile")] });

  const acute: AnswerBlock[] = [];
  const used = ctx.overuse.byClass.filter((c) => c.days > 0);
  if (used.length) {
    acute.push({
      text: `Acute medication days (30 days): ${used.map((c) => `${CLASS_LABEL[c.cls] ?? c.cls} ${c.days}/${c.threshold}`).join(", ")}${ctx.overuse.overused.length || ctx.overuse.multipleClassOveruse ? " — at or above ICHD-3 overuse thresholds" : ""}.`,
      sources: [rec("Medication doses"), gl("ichd-3-moh")],
    });
  }
  for (const r of ctx.medicationResponses.filter((x) => x.rated > 0)) {
    acute.push({
      text: `${r.medication.name}: pain-free at 2 h in ${r.painFree}/${r.rated}, partial ${r.partial}/${r.rated}, recurrence ${r.recurrence}${r.medianDelayMin !== null ? `; median ${r.medianDelayMin} min from onset to dose` : ""}.`,
      sources: [rec("Medication doses"), gl("ahs-2021-consensus")],
    });
  }
  const preventive = ctx.medications.filter((m) => m.active && m.role === "preventive");
  acute.push({
    text: preventive.length ? `Current preventive: ${preventive.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ""}${m.startDate ? ` (since ${formatDate(m.startDate)})` : ""}`).join(", ")}.` : "No preventive medicine recorded.",
    sources: [rec("Medicines list")],
  });

  const patterns: AnswerBlock[] = [];
  const top = ctx.triggers.filter((t) => t.exposedDays >= 3 && t.rr > 1.1).slice(0, 5);
  if (top.length) patterns.push({ text: `Triggers in the patient's own data: ${top.map((t) => `${t.label} RR ${t.rr.toFixed(1)} (${t.exposedDays} exposed days)`).join("; ")}.`, sources: [rec("Trigger estimates")] });
  if (ctx.sleepScore.suggestion) patterns.push({ text: `Sleep score below ${ctx.sleepScore.suggestion.below}: RR ${ctx.sleepScore.suggestion.relativeRisk.toFixed(1)} for an attack the same or next day.`, sources: [rec("Wearable data")] });
  if (ctx.tracksCycle && ctx.menstrual?.meetsCriteria) {
    patterns.push({ text: `Attacks in the perimenstrual window in ${ctx.menstrual.cyclesWithAttack}/${ctx.menstrual.cycles} cycles (${ctx.menstrual.pure ? "pure menstrual" : "menstrually related"} pattern).`, sources: [rec("Periods"), gl("ichd-3")] });
  }

  const flags: AnswerBlock[] = ctx.recommendations
    .filter((r) => r.severity === "urgent" || r.severity === "warning")
    .map((r) => ({ text: `${r.title}. ${r.detail}`, sources: r.sources.map(gl) }));

  const changes: AnswerBlock[] = [
    ...ctx.notes.slice(0, 5).map((n) => ({ text: `${n.title}: ${n.text}`, sources: n.sources })),
    ...ctx.lifeEvents.slice(-5).map((e) => ({ text: `Life event: ${e.label} (from ${formatDate(e.date)}${e.endDate ? ` to ${formatDate(e.endDate)}` : ""}).`, sources: [rec("Life events")] })),
  ];

  const discuss: AnswerBlock[] = ctx.recommendations
    .filter((r) => r.category === "prevention" || r.category === "acute-treatment")
    .slice(0, 4)
    .map((r) => ({ text: r.title, sources: r.sources.map(gl) }));

  return {
    mode: "basic",
    generatedFor: ctx.today,
    sections: [
      { heading: "Overview", items: overview },
      { heading: "Treatment", items: acute },
      { heading: "Patterns", items: patterns },
      { heading: "Flags", items: flags },
      { heading: "Recent changes", items: changes },
      { heading: "To discuss", items: discuss },
    ].filter((s) => s.items.length),
  };
}
