import SourceLinks from "@/components/SourceLinks";
import type { AnswerBlock } from "@shared/assist/types";

/** Answer text with where each statement came from: the patient's records, or a guideline. */
export default function AnswerView({ blocks }: { blocks: AnswerBlock[] }) {
  return (
    <div className="space-y-2 text-sm">
      {blocks.map((b, i) => {
        const records = [...new Set(b.sources.flatMap((s) => (s.kind === "record" ? [s.label] : [])))];
        const guidelines = [...new Set(b.sources.flatMap((s) => (s.kind === "guideline" ? [s.id] : [])))];
        return (
          <div key={i}>
            <p>{b.text}</p>
            {records.length > 0 && <p className="text-xs text-muted-foreground mt-1">From your records: {records.join(" · ")}</p>}
            <SourceLinks ids={guidelines} />
          </div>
        );
      })}
    </div>
  );
}
