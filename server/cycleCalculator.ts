interface CycleEntry {
  startDate: string;
  endDate?: string;
}

export interface CyclePhaseInfo {
  currentDay: number;
  cycleLength: number;
  phase: 'menstruation' | 'follicular' | 'ovulation' | 'luteal';
  daysUntilPeriod: number;
  isHighRiskPMS: boolean;
}

export function calculateCyclePhase(cycleEntries: CycleEntry[]): CyclePhaseInfo | null {
  if (cycleEntries.length === 0) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter to only include cycles that have already started (not future dates)
  const pastCycles = cycleEntries.filter(entry => {
    const startDate = new Date(entry.startDate);
    startDate.setHours(0, 0, 0, 0);
    return startDate <= today;
  });

  if (pastCycles.length === 0) {
    return null;
  }

  // Sort by start date descending to get most recent
  const sortedCycles = [...pastCycles].sort((a, b) => 
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  const latestCycle = sortedCycles[0];
  
  const cycleStart = new Date(latestCycle.startDate);
  cycleStart.setHours(0, 0, 0, 0);

  // Calculate days since period started
  const daysSinceStart = Math.floor((today.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
  
  // User's known average cycle length
  const averageCycleLength = 26;

  // Calculate current cycle day (1-indexed)
  // For regular cycles: count normally
  // For late cycles: continue counting beyond average length to show how late
  const currentDay = daysSinceStart + 1;
  
  // Determine phase based on where we are in the cycle
  let phase: 'menstruation' | 'follicular' | 'ovulation' | 'luteal';
  let isHighRiskPMS = false;

  if (currentDay <= 5) {
    phase = 'menstruation';
  } else if (currentDay <= 13) {
    phase = 'follicular';
  } else if (currentDay <= 16) {
    phase = 'ovulation';
  } else {
    // Luteal phase (including late period scenarios)
    phase = 'luteal';
    
    // PMS risk window: 7 days before expected period through 3 days after (for late cycles)
    const daysBeforePeriod = averageCycleLength - currentDay;
    const daysPastExpectedPeriod = currentDay - averageCycleLength;
    
    // High risk if within 7 days before expected period OR up to 3 days after (late period)
    isHighRiskPMS = (daysBeforePeriod <= 7 && daysBeforePeriod >= 0) || 
                     (daysPastExpectedPeriod >= 0 && daysPastExpectedPeriod <= 3);
  }

  // Days until next period (0 or negative if period is late)
  const daysUntilPeriod = Math.max(0, averageCycleLength - currentDay);

  return {
    currentDay,
    cycleLength: averageCycleLength,
    phase,
    daysUntilPeriod: Math.max(0, daysUntilPeriod),
    isHighRiskPMS
  };
}

export function getCyclePhaseOnDate(cycleEntries: CycleEntry[], targetDate: Date): string {
  if (cycleEntries.length === 0) return 'unknown';

  const sortedCycles = [...cycleEntries].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  // Find the cycle that contains this date
  for (let i = 0; i < sortedCycles.length; i++) {
    const cycleStart = new Date(sortedCycles[i].startDate);
    const nextCycleStart = i < sortedCycles.length - 1 
      ? new Date(sortedCycles[i + 1].startDate)
      : new Date(cycleStart.getTime() + 35 * 24 * 60 * 60 * 1000); // Assume max 35 days

    if (targetDate >= cycleStart && targetDate < nextCycleStart) {
      const dayInCycle = Math.floor((targetDate.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      if (dayInCycle <= 5) return 'Menstruation';
      if (dayInCycle <= 13) return 'Follicular';
      if (dayInCycle <= 16) return 'Ovulation';
      return 'Luteal';
    }
  }

  return 'unknown';
}
