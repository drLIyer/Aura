import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";

interface SupplementEntry {
  name: string;
}

interface SupplementCardProps {
  supplementLog: SupplementEntry[];
}

export default function SupplementCard({ supplementLog }: SupplementCardProps) {
  const supplements = ['CoQ10', 'Magnesium Citrate', 'Vitamin B2', 'Selenium'];
  
  return (
    <Card className="p-6" data-testid="card-supplements">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Today's Supplements</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {supplementLog.length} of {supplements.length} taken
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {supplements.map((supp) => {
          const taken = supplementLog.some(log => log.name === supp);
          return (
            <div
              key={supp}
              className={`p-3 rounded-lg border-2 transition ${
                taken
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-muted border-border'
              }`}
              data-testid={`supplement-${supp.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="text-sm font-medium text-foreground">{supp}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {taken ? '✓ Taken' : '○ Not taken'}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
