import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GUIDELINES, type GuidelineKind } from "@shared/engine/domain/guidelines";

const KIND: Record<GuidelineKind, string> = {
  guideline: "Clinical guideline",
  consensus: "Consensus statement",
  "diagnostic-criteria": "Diagnostic criteria",
  safety: "Safety",
  research: "Research",
  "patient-education": "Patient resource",
};

/** Every source the app's recommendations cite, with what the app takes from it. */
export default function Guidelines() {
  const order: GuidelineKind[] = ["guideline", "consensus", "diagnostic-criteria", "safety", "patient-education", "research"];
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Guidelines & sources</h1>
        <p className="text-muted-foreground mt-1">
          Every alert in the app links to one of these. They come from the American Headache Society, the American Academy of Neurology, the International
          Headache Society, the American Migraine Foundation and others.
        </p>
      </div>
      {order.map((kind) => (
        <div key={kind} className="space-y-3">
          <h2 className="text-lg font-semibold">{KIND[kind]}</h2>
          {GUIDELINES.filter((g) => g.kind === kind).map((g) => (
            <Card key={g.id} className="p-5" data-testid={`guideline-${g.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <a href={g.url} target="_blank" rel="noreferrer" className="font-medium underline-offset-2 hover:underline">
                  {g.title}
                </a>
                <Badge variant="outline">{g.year}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {g.organization}
                {g.citation && ` · ${g.citation}`}
              </p>
              <ul className="text-sm list-disc pl-5 mt-2">
                {g.usedFor.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
              {g.note && <p className="text-xs text-muted-foreground mt-2">{g.note}</p>}
              <p className="text-xs text-muted-foreground mt-1">Last checked {g.reviewedOn}</p>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}
