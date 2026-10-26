import { useQuery } from "@tanstack/react-query";
import TrendsChart from "@/components/TrendsChart";
import CycleAnalyticsChart from "@/components/CycleAnalyticsChart";
import { Card } from "@/components/ui/card";

export default function Analytics() {
  const { data: trendData } = useQuery<any[]>({
    queryKey: ['/api/health/trends', 30],
    queryFn: async () => {
      const response = await fetch('/api/health/trends?days=30');
      return response.json();
    }
  });

  const { data: migraineLog } = useQuery<any[]>({
    queryKey: ['/api/migraines'],
  });

  const { data: cycleLog } = useQuery<any[]>({
    queryKey: ['/api/cycle'],
  });

  const { data: cycleCorrelation } = useQuery<any[]>({
    queryKey: ['/api/analytics/cycle-correlation'],
  });

  const trends = trendData?.map((d: any) => ({
    date: d.date,
    readiness: d.readiness,
    sleep: d.sleep,
    stress: d.stress,
    migraine: 0
  })) ?? [];

  const cycleData = cycleCorrelation ?? [
    { phase: 'Menstruation', migraines: 0, total: 0, percentage: 0 },
    { phase: 'Follicular', migraines: 0, total: 0, percentage: 0 },
    { phase: 'Ovulation', migraines: 0, total: 0, percentage: 0 },
    { phase: 'Luteal', migraines: 0, total: 0, percentage: 0 }
  ];

  const migraineHistory = migraineLog?.map((migraine: any) => ({
    date: new Date(migraine.timestamp).toLocaleDateString(),
    severity: migraine.severity,
    duration: migraine.duration,
    phase: 'Analysis in progress'
  })) ?? [];

  const totalMigraines = migraineLog?.length ?? 0;
  const avgSeverity = migraineLog && migraineLog.length > 0
    ? (migraineLog.reduce((sum: number, m: any) => sum + m.severity, 0) / migraineLog.length).toFixed(1)
    : 0;
  
  const lutealMigraines = cycleCorrelation?.find(c => c.phase === 'Luteal')?.migraines ?? 0;
  const pmsPercentage = totalMigraines > 0 ? Math.round((lutealMigraines / totalMigraines) * 100) : 0;

  return (
    <div className="space-y-6">
      {trends.length > 0 && <TrendsChart data={trends} days={30} />}

      {cycleData && <CycleAnalyticsChart data={cycleData} />}

      <Card className="p-6" data-testid="card-migraine-history">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Migraine History</h2>
        {migraineHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No migraines logged yet. Log your first migraine to start tracking patterns.
          </p>
        ) : (
          <div className="space-y-3">
            {migraineHistory.slice(0, 10).map((migraine: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 bg-muted rounded-lg"
                data-testid={`migraine-history-${idx}`}
              >
                <div className="flex-1">
                  <div className="font-medium text-foreground">{migraine.date}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {migraine.phase}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Severity</div>
                    <div className="text-lg font-bold text-destructive">{migraine.severity}/10</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Duration</div>
                    <div className="text-lg font-semibold text-foreground">{migraine.duration}h</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6" data-testid="card-stat-total">
          <div className="text-sm text-muted-foreground mb-1">Total Migraines</div>
          <div className="text-3xl font-bold text-foreground">{totalMigraines}</div>
          <div className="text-xs text-muted-foreground mt-1">All time</div>
        </Card>
        <Card className="p-6" data-testid="card-stat-average">
          <div className="text-sm text-muted-foreground mb-1">Average Severity</div>
          <div className="text-3xl font-bold text-destructive">{avgSeverity}/10</div>
          <div className="text-xs text-muted-foreground mt-1">Across all episodes</div>
        </Card>
        <Card className="p-6" data-testid="card-stat-pms">
          <div className="text-sm text-muted-foreground mb-1">PMS-Related</div>
          <div className="text-3xl font-bold text-pink-500">{pmsPercentage}%</div>
          <div className="text-xs text-muted-foreground mt-1">Luteal phase correlation</div>
        </Card>
      </div>
    </div>
  );
}
