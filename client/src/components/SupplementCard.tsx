import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Supplement } from "@/lib/types";

interface Props {
  supplements: Supplement[];
  takenNames: string[];
  onToggle: (s: Supplement) => void;
  onManage: () => void;
}

/** Checklist of the user's own supplements (managed on the Medications page). */
export default function SupplementCard({ supplements, takenNames, onToggle, onManage }: Props) {
  const active = supplements.filter((s) => s.active);
  return (
    <Card className="p-6" data-testid="card-supplements">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Today's supplements</h2>
        </div>
        {active.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {active.filter((s) => takenNames.includes(s.name)).length} of {active.length} taken
          </span>
        )}
      </div>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No supplements set up.{" "}
          <button className="underline" onClick={onManage}>
            Add the ones you take
          </button>
          .
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {active.map((s) => {
            const taken = takenNames.includes(s.name);
            return (
              <button
                key={s.id}
                onClick={() => onToggle(s)}
                aria-pressed={taken}
                className={`p-3 rounded-lg border-2 text-left transition ${taken ? "bg-green-500/10 border-green-500/30" : "bg-muted border-border"}`}
                data-testid={`supplement-${s.id}`}
              >
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {taken ? "✓ Taken" : "○ Tap when taken"}
                  {s.dailyMg ? ` · ${s.dailyMg} mg` : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
