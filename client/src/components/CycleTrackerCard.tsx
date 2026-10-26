import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatShortDate } from "@/lib/dates";
import type { CycleStatus } from "@/lib/types";

const PHASES = {
  menstruation: { label: "Period", color: "text-red-500", bg: "bg-red-500/10" },
  follicular: { label: "Follicular phase", color: "text-blue-500", bg: "bg-blue-500/10" },
  ovulation: { label: "Around ovulation", color: "text-purple-500", bg: "bg-purple-500/10" },
  luteal: { label: "Luteal phase", color: "text-amber-600", bg: "bg-amber-500/10" },
};

export default function CycleTrackerCard({ status, onLogPeriod }: { status: CycleStatus | null | undefined; onLogPeriod: () => void }) {
  const phase = status ? PHASES[status.phase] : null;
  return (
    <Card className="p-6" data-testid="card-cycle-tracker">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-pink-500" />
          <h2 className="text-lg font-semibold text-foreground">Menstrual cycle</h2>
        </div>
        <Button size="sm" variant="outline" onClick={onLogPeriod} data-testid="button-log-period">
          Log period
        </Button>
      </div>
      {status && phase ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cycle day</span>
            <span className="text-2xl font-bold" data-testid="text-cycle-day">
              {status.cycleDay} <span className="text-sm font-normal text-muted-foreground">of ~{status.averageLength}</span>
            </span>
          </div>
          <div className={`p-3 rounded-md ${phase.bg} flex items-center justify-between`}>
            <span className="text-sm font-medium">Phase</span>
            <span className={`text-sm font-semibold ${phase.color}`} data-testid="text-cycle-phase">
              {phase.label}
            </span>
          </div>
          {status.inHigherRiskWindow && (
            <p className="text-sm rounded-md bg-pink-500/10 p-3" data-testid="text-period-window">
              You're in the days around your period (2 days before to 3 days after it starts), when migraine is more likely for many people. Keep
              your medicine handy and go easy on known triggers.
            </p>
          )}
          <div className="pt-2 border-t border-border text-sm flex items-center justify-between">
            <span className="text-muted-foreground">{status.late ? "Period expected" : "Next period expected"}</span>
            <span className="font-medium" data-testid="text-next-period">
              {formatShortDate(status.nextStart)}
              {status.daysUntilNext > 0 && ` (in ${status.daysUntilNext} days)`}
              {status.late && " — late?"}
            </span>
          </div>
          {status.lengthIsEstimated && (
            <p className="text-xs text-muted-foreground">Using a 28-day estimate until you've logged two periods; then it learns your own cycle length.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-cycle-data">
          No periods logged yet. Log one, or import from Clue, Flo, Fitbit, Oura or Garmin, to track your cycle.
        </p>
      )}
    </Card>
  );
}
