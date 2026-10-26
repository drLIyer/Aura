import { AlertTriangle, CheckCircle, Info, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Recommendation } from "@/lib/types";
import SourceLinks from "./SourceLinks";

const STYLE: Record<Recommendation["severity"], { border: string; icon: JSX.Element }> = {
  urgent: { border: "border-l-red-600 bg-red-500/5", icon: <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" /> },
  warning: { border: "border-l-orange-500 bg-orange-500/5", icon: <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" /> },
  info: { border: "border-l-blue-500 bg-blue-500/5", icon: <Info className="w-5 h-5 text-chart-2 shrink-0" /> },
  positive: { border: "border-l-green-500 bg-green-500/5", icon: <CheckCircle className="w-5 h-5 text-chart-3 shrink-0" /> },
};

interface Props {
  recommendations: Recommendation[];
  title?: string;
  emptyText?: string;
  limit?: number;
}

export default function RecommendationsCard({ recommendations, title = "Insights & Alerts", emptyText = "Nothing needs your attention right now.", limit }: Props) {
  const shown = limit ? recommendations.slice(0, limit) : recommendations;
  return (
    <Card className="p-6" data-testid="card-recommendations">
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <div key={r.id} className={`p-4 border-l-4 rounded-md ${STYLE[r.severity].border}`} data-testid={`rec-${r.id}`}>
              <div className="flex items-start gap-3">
                {STYLE[r.severity].icon}
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground mb-1">{r.title}</h3>
                  <p className="text-sm text-muted-foreground">{r.detail}</p>
                  <SourceLinks ids={r.sources} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {limit && recommendations.length > limit && (
        <p className="text-xs text-muted-foreground mt-3">{recommendations.length - limit} more in your report.</p>
      )}
    </Card>
  );
}
