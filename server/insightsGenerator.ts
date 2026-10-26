import { getCyclePhaseOnDate } from './cycleCalculator';

interface MigraineEntry {
  timestamp: Date;
  severity: number;
  duration: number;
  symptoms: string[];
  triggers: string;
}

interface WaterEntry {
  timestamp: Date;
  amount: number;
}

interface CycleEntry {
  startDate: string;
  endDate?: string;
}

interface HealthMetric {
  date: string;
  sleep: number;
  stress: number;
}

interface Insight {
  type: 'cycle' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
}

export function generateInsights(
  migraines: MigraineEntry[],
  waterLog: WaterEntry[],
  cycleLog: CycleEntry[],
  healthMetrics: HealthMetric[]
): Insight[] {
  const insights: Insight[] = [];

  // Analyze cycle correlation
  if (cycleLog.length > 0 && migraines.length > 0) {
    const cyclePhases = migraines.map(m => getCyclePhaseOnDate(cycleLog, m.timestamp));
    const lutealCount = cyclePhases.filter(p => p === 'Luteal').length;
    const lutealPercentage = Math.round((lutealCount / migraines.length) * 100);

    if (lutealPercentage >= 60) {
      insights.push({
        type: 'cycle',
        title: 'PMS Migraine Pattern Detected',
        message: `${lutealPercentage}% of your migraines occur during the luteal phase. This suggests a strong correlation with premenstrual hormone changes.`
      });
    }
  }

  // Analyze hydration patterns
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayWater = waterLog
    .filter(w => new Date(w.timestamp).toDateString() === yesterday.toDateString())
    .reduce((sum, w) => sum + w.amount, 0);

  if (yesterdayWater < 1500) {
    insights.push({
      type: 'warning',
      title: 'Low Water Intake Yesterday',
      message: `You drank only ${yesterdayWater}ml yesterday. Aim for at least 2000ml daily. Dehydration is a common migraine trigger.`
    });
  }

  // Analyze sleep patterns
  if (healthMetrics.length >= 7) {
    const recentMetrics = healthMetrics.slice(-7);
    const avgSleep = Math.round(recentMetrics.reduce((sum, m) => sum + m.sleep, 0) / recentMetrics.length);
    const lowSleepDays = recentMetrics.filter(m => m.sleep < 65).length;

    if (lowSleepDays >= 3) {
      insights.push({
        type: 'info',
        title: 'Sleep Quality Concerns',
        message: `Your sleep score has been below 65 on ${lowSleepDays} of the last 7 days. Poor sleep is strongly linked to migraine frequency.`
      });
    } else if (avgSleep >= 75) {
      insights.push({
        type: 'success',
        title: 'Good Sleep Pattern',
        message: `Your average sleep score this week is ${avgSleep}. Consistent quality sleep helps prevent migraines!`
      });
    }
  }

  return insights;
}

export interface CycleCorrelationData {
  phase: string;
  migraines: number;
  total: number;
  percentage: number;
}

export function calculateCycleCorrelation(
  migraines: MigraineEntry[],
  cycleLog: CycleEntry[]
): CycleCorrelationData[] {
  if (migraines.length === 0) {
    return [
      { phase: 'Menstruation', migraines: 0, total: 0, percentage: 0 },
      { phase: 'Follicular', migraines: 0, total: 0, percentage: 0 },
      { phase: 'Ovulation', migraines: 0, total: 0, percentage: 0 },
      { phase: 'Luteal', migraines: 0, total: 0, percentage: 0 }
    ];
  }

  const phaseCount: Record<string, number> = {
    'Menstruation': 0,
    'Follicular': 0,
    'Ovulation': 0,
    'Luteal': 0
  };

  migraines.forEach(m => {
    const phase = getCyclePhaseOnDate(cycleLog, m.timestamp);
    if (phaseCount[phase] !== undefined) {
      phaseCount[phase]++;
    }
  });

  const total = migraines.length;

  return Object.entries(phaseCount).map(([phase, count]) => ({
    phase,
    migraines: count,
    total,
    percentage: Math.round((count / total) * 100)
  }));
}
