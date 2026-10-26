import { Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CycleTrackerCardProps {
  currentDay: number | null;
  cycleLength: number | null;
  phase: 'menstruation' | 'follicular' | 'ovulation' | 'luteal' | null;
  daysUntilPeriod: number | null;
  onLogPeriod: () => void;
}

export default function CycleTrackerCard({ currentDay, cycleLength, phase, daysUntilPeriod, onLogPeriod }: CycleTrackerCardProps) {
  const phaseInfo = {
    menstruation: { label: 'Menstruation', color: 'text-red-500', bg: 'bg-red-500/10' },
    follicular: { label: 'Follicular Phase', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    ovulation: { label: 'Ovulation', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    luteal: { label: 'Luteal Phase (PMS Risk)', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  };

  const hasData = currentDay !== null && phase !== null;
  const currentPhase = phase ? phaseInfo[phase] : null;

  return (
    <Card className="p-6" data-testid="card-cycle-tracker">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-pink-500" />
          <h2 className="text-lg font-semibold text-foreground">Menstrual Cycle</h2>
        </div>
        <Button 
          size="sm" 
          variant="outline"
          onClick={onLogPeriod}
          data-testid="button-log-period"
        >
          Log Period
        </Button>
      </div>
      {hasData && currentPhase ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cycle Day</span>
            <span className="text-2xl font-bold text-foreground" data-testid="text-cycle-day">{currentDay} / {cycleLength}</span>
          </div>
          <div className={`p-3 rounded-md ${currentPhase.bg}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Current Phase</span>
              <span className={`text-sm font-semibold ${currentPhase.color}`} data-testid="text-cycle-phase">
                {currentPhase.label}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Days until next period</span>
              <span className="font-medium text-foreground" data-testid="text-days-until-period">{daysUntilPeriod} days</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground" data-testid="text-no-cycle-data">
            No cycle data yet. Log your period to start tracking.
          </p>
        </div>
      )}
    </Card>
  );
}
