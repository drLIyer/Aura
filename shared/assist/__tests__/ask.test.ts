import { describe, expect, it } from "vitest";
import { demoState } from "../../engine/demo";
import { answerQuestion, SUGGESTED_QUESTIONS } from "../ask";
import { buildAssistContext } from "../context";
import { checkAnswer, guidelineDocs, recordDocs } from "../grounding";
import { FALLBACK_ANSWER } from "../types";
import { searchExcerpts, GUIDELINE_EXCERPTS } from "../../engine/domain/guidelineExcerpts";
import { GUIDELINES } from "../../engine/domain/guidelines";

const TODAY = "2026-10-26";
const ctx = buildAssistContext(demoState(TODAY), TODAY);

describe("Ask (basic mode)", () => {
  it.each(SUGGESTED_QUESTIONS)("answers “%s” from the records, with sources", (q) => {
    const a = answerQuestion(q, ctx);
    expect(a.fallback).toBe(false);
    expect(a.blocks.length).toBeGreaterThan(0);
    for (const b of a.blocks) expect(b.sources.length).toBeGreaterThan(0);
  });

  it("uses the engine's own numbers", () => {
    const text = answerQuestion("Why is my risk what it is today?", ctx).blocks[0].text;
    expect(text).toContain(`${Math.round(ctx.forecast.probability * 100)}%`);
    const sleep = answerQuestion("Does my sleep score matter?", ctx).blocks.map((b) => b.text).join(" ");
    expect(sleep).toContain(`below ${ctx.sleepScore.suggestion!.below}`);
  });

  it("says so when the question is outside its records and guidelines", () => {
    const a = answerQuestion("What's the capital of France?", ctx);
    expect(a.fallback).toBe(true);
    expect(a.blocks[0].text).toBe(FALLBACK_ANSWER);
    expect(a.suggestions.length).toBeGreaterThan(0);
  });

  it("only restates Aura's flags for a medicine question, and never calls it safe", () => {
    const a = answerQuestion("Can I take ibuprofen?", ctx);
    const text = a.blocks.map((b) => b.text).join(" ");
    expect(text).toMatch(/Ibuprofen/);
    expect(text).not.toMatch(/\bsafe\b/i);
  });

  it("brings in pregnancy guidance for medicine questions when pregnant", () => {
    const state = demoState(TODAY);
    state.profile.pregnant = true;
    state.medications.push({ id: "ibu", name: "Ibuprofen", cls: "nsaid", role: "acute", active: true });
    const a = answerQuestion("Can I take ibuprofen?", buildAssistContext(state, TODAY));
    expect(a.blocks.flatMap((b) => b.sources).some((s) => s.kind === "guideline" && s.id === "fda-2020-nsaid-pregnancy")).toBe(true);
  });

  it("answers supplement questions from the evidence catalog", () => {
    const a = answerQuestion("Should I take magnesium?", ctx);
    expect(a.blocks[0].text).toMatch(/Magnesium for migraine prevention: Level B/);
    expect(a.blocks[0].sources).toEqual([{ kind: "guideline", id: "aan-ahs-2012-complementary" }]);
  });
});

describe("guideline excerpts", () => {
  it("are the registry's own statements, all awaiting clinician review", () => {
    expect(GUIDELINE_EXCERPTS.length).toBe(GUIDELINES.reduce((n, g) => n + g.usedFor.length, 0));
    expect(GUIDELINE_EXCERPTS.every((e) => e.review === "needs-clinician-review")).toBe(true);
  });

  it("are found by whole words and topics", () => {
    expect(searchExcerpts("ibuprofen in pregnancy")[0].guidelineId).toBe("fda-2020-nsaid-pregnancy");
    // "take" must not match "intake"
    expect(searchExcerpts("take magnesium").map((e) => e.guidelineId)).not.toContain("mostofsky-2019-caffeine");
  });
});

describe("grounding checks (AI mode)", () => {
  const docs = [...guidelineDocs(ctx, "triggers"), ...recordDocs(ctx)];
  const triggersDoc = docs.findIndex((d) => d.title === "Your records: triggers");

  it("builds record documents from engine outputs only", () => {
    expect(triggersDoc).toBeGreaterThanOrEqual(0);
    expect(docs.find((d) => d.title === "Your records: forecast")!.text).toContain(`${Math.round(ctx.forecast.probability * 100)}%`);
  });

  it("keeps cited statements and rebuilds sentences split around citations", () => {
    const { blocks, dropped } = checkAnswer(
      [
        { text: "Your strongest trigger is ", cited: [] },
        { text: "an argument or conflict, at 1.9×.", cited: [triggersDoc] },
        { text: " Hope that helps!", cited: [] },
      ],
      docs,
      ctx,
    );
    expect(dropped).toBe(0);
    expect(blocks[0]).toEqual({ text: "Your strongest trigger is an argument or conflict, at 1.9×.", sources: [{ kind: "record", label: "Triggers" }] });
    expect(blocks[1].text).toBe("Hope that helps!");
  });

  it("drops uncited health claims", () => {
    const { blocks, dropped } = checkAnswer([{ text: "You should take 800 mg of ibuprofen.", cited: [] }], docs, ctx);
    expect(dropped).toBe(1);
    expect(blocks).toEqual([{ text: FALLBACK_ANSWER, sources: [] }]);
  });

  it("replaces a 'safe' claim that contradicts Aura's flags with the flag itself", () => {
    const checksDoc = docs.findIndex((d) => d.title === "Aura's safety and guideline checks");
    const { blocks, dropped } = checkAnswer([{ text: "Ibuprofen is safe for you to keep using.", cited: [checksDoc] }], docs, ctx);
    expect(dropped).toBe(1);
    expect(blocks[0].text).toMatch(/^Ibuprofen is often not working/);
  });
});
