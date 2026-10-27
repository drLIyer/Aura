import { answerQuestion } from "./ask";
import { parseCapture } from "./capture";
import { basicSummary } from "./summary";
import type { Answer, AssistContext, AssistProvider, CaptureContext, CaptureProposal, Note, PreVisitSummary } from "./types";

/** Basic mode: fixed rules, no network, no key. Works in the browser demo too. */
export class RuleProvider implements AssistProvider {
  readonly mode = "basic" as const;

  async capture(text: string, ctx: CaptureContext): Promise<CaptureProposal> {
    return parseCapture(text, ctx);
  }
  async ask(question: string, ctx: AssistContext): Promise<Answer> {
    return answerQuestion(question, ctx);
  }
  async phraseNotes(notes: Note[]): Promise<Note[]> {
    return notes;
  }
  async summary(ctx: AssistContext): Promise<PreVisitSummary> {
    return basicSummary(ctx);
  }
}
