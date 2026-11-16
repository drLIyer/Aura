import { useQuery } from "@tanstack/react-query";
import { ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { PreVisitSummary } from "@shared/assist/types";
import AnswerView from "./AnswerView";

/** A one-glance summary for the clinician, built from the same engine outputs as the rest of the report. */
export default function PreVisitSummaryCard({ date }: { date: string }) {
  const { toast } = useToast();
  const { data: s, isError } = useQuery<PreVisitSummary>({ queryKey: [`/api/assist/summary?date=${date}`] });
  if (isError) return null;
  if (!s) return <Card className="p-6 text-sm text-muted-foreground">Preparing the summary…</Card>;

  const asText = () => s.sections.map((sec) => `${sec.heading}\n${sec.items.map((i) => `- ${i.text}`).join("\n")}`).join("\n\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      toast({ title: "Summary copied" });
    } catch {
      toast({ title: "Couldn't copy", description: "Select the text and copy it instead.", variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 space-y-4 print:break-inside-avoid" data-testid="card-previsit-summary">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Pre-visit summary</h2>
          <p className="text-xs text-muted-foreground">
            {s.mode === "ai" ? "Written by AI from the records below; every line is cited." : "Filled in from the records below."} Not a diagnosis.
            {s.notice ? ` ${s.notice}` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={copy} className="print:hidden shrink-0">
          <ClipboardCopy className="w-4 h-4 mr-1" /> Copy
        </Button>
      </div>
      {s.sections.map((sec) => (
        <div key={sec.heading}>
          <h3 className="text-sm font-semibold mb-1">{sec.heading}</h3>
          <AnswerView blocks={sec.items} />
        </div>
      ))}
    </Card>
  );
}
