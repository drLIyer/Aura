import { Activity, AlertTriangle, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Forecast } from "@/lib/types";

const LEVELS = {
  low: { label: "Lower than usual", color: "text-green-600", bar: "bg-green-500", bg: "from-green-500/10 to-green-600/5", Icon: Shield },
  moderate: { label: "About usual", color: "text-yellow-600", bar: "bg-yellow-500", bg: "from-yellow-500/10 to-yellow-600/5", Icon: Activity },
  high: { label: "Higher than usual", color: "text-orange-600", bar: "bg-orange-500", bg: "from-orange-500/10 to-orange-600/5", Icon: AlertTriangle },
  "very-high": { label: "Much higher than usual", color: "text-red-600", bar: "bg-red-500", bg: "from-red-500/10 to-red-600/5", Icon: AlertTriangle },
} as const;

const VIA: Record<string, string> = {
  "check-in": "from your check-in",
  wearable: "from your wearable",
  "cycle forecast": "predicted from your cycle",
  "warning signs": "early warning signs",
};

/**
 * The forecast is a personal pattern signal, framed against the user's own usual rate rather than
 * as an alarming absolute number. The reasons are always listed.
 */
export default function ForecastCard({ forecast }: { forecast: Forecast }) {
  const level = LEVELS[forecast.level];
  const pct = Math.round(forecast.probability * 100);
  const usual = Math.round(forecast.baseRate * 100);
  const raising = forecast.contributors.filter((c) => c.rr > 1.05);
  return (
    <Card className={`p-6 bg-gradient-to-br ${level.bg}`} data-testid="card-forecast">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <level.Icon className={`h-5 w-5 ${level.color}`} />
          <p className="text-sm font-medium text-muted-foreground">Today and tomorrow</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${level.color} bg-white/60 dark:bg-black/20`} data-testid="badge-forecast-level">
          {level.label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl font-bold ${level.color}`} data-testid="text-forecast-pct">
          {pct}%
        </span>
        <span className="text-sm text-muted-foreground">chance of an attack starting · your usual is {usual}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 mt-3 overflow-hidden">
        <div className={`h-full rounded-full ${level.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="pt-3 mt-3 border-t border-border/50">
        {raising.length ? (
          <>
            <p className="text-xs font-medium text-muted-foreground mb-2">What's raising it</p>
            <ul className="space-y-1">
              {raising.slice(0, 5).map((c) => (
                <li key={c.id} className="flex justify-between text-xs">
                  <span className="text-foreground">
                    {c.label} <span className="text-muted-foreground">({VIA[c.via] ?? c.via})</span>
                  </span>
                  <span className="text-muted-foreground">×{c.rr.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Nothing known is raising your risk today.</p>
        )}
        {forecast.missing.length > 0 && <p className="text-xs text-muted-foreground mt-2">Add {forecast.missing.join(", ")} to sharpen this.</p>}
        <p className="text-[11px] text-muted-foreground mt-2">A personal pattern signal from {forecast.loggedDays} logged days, not a diagnosis.</p>
      </div>
    </Card>
  );
}
