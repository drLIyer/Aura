interface MigraineProbability {
  probability: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
  factors: {
    name: string;
    impact: 'positive' | 'negative' | 'neutral';
    value: number;
    contribution: number;
  }[];
}

interface HealthScores {
  readiness?: number;
  sleep?: number;
  stress?: number;
}

export function calculateMigraineProbability(
  scores: HealthScores,
  cycleDay?: number,
  cyclePhase?: string
): MigraineProbability {
  const factors: MigraineProbability['factors'] = [];
  let baseProbability = 15;

  if (scores.readiness !== undefined) {
    const readinessContribution = scores.readiness < 60 ? 20 : scores.readiness < 75 ? 10 : -5;
    baseProbability += readinessContribution;
    factors.push({
      name: 'Readiness',
      impact: scores.readiness >= 75 ? 'positive' : scores.readiness < 60 ? 'negative' : 'neutral',
      value: scores.readiness,
      contribution: readinessContribution
    });
  }

  if (scores.sleep !== undefined) {
    const sleepContribution = scores.sleep < 70 ? 15 : scores.sleep < 80 ? 5 : -5;
    baseProbability += sleepContribution;
    factors.push({
      name: 'Sleep Quality',
      impact: scores.sleep >= 80 ? 'positive' : scores.sleep < 70 ? 'negative' : 'neutral',
      value: scores.sleep,
      contribution: sleepContribution
    });
  }

  if (scores.stress !== undefined) {
    const stressContribution = scores.stress < 70 ? 20 : scores.stress < 80 ? 8 : -5;
    baseProbability += stressContribution;
    factors.push({
      name: 'Stress Management',
      impact: scores.stress >= 80 ? 'positive' : scores.stress < 70 ? 'negative' : 'neutral',
      value: scores.stress,
      contribution: stressContribution
    });
  }

  if (cycleDay !== undefined && cyclePhase) {
    let cycleContribution = 0;
    if (cyclePhase === 'luteal' && cycleDay >= 21) {
      cycleContribution = 15;
    } else if (cyclePhase === 'luteal') {
      cycleContribution = 10;
    } else if (cyclePhase === 'menstruation') {
      cycleContribution = 8;
    } else if (cyclePhase === 'ovulation') {
      cycleContribution = 5;
    } else {
      cycleContribution = -3;
    }

    baseProbability += cycleContribution;
    factors.push({
      name: 'Cycle Phase',
      impact: cycleContribution > 5 ? 'negative' : cycleContribution < 0 ? 'positive' : 'neutral',
      value: cycleDay,
      contribution: cycleContribution
    });
  }

  const probability = Math.max(5, Math.min(95, baseProbability));

  let riskLevel: MigraineProbability['riskLevel'];
  if (probability < 25) {
    riskLevel = 'low';
  } else if (probability < 45) {
    riskLevel = 'moderate';
  } else if (probability < 65) {
    riskLevel = 'high';
  } else {
    riskLevel = 'very_high';
  }

  return {
    probability: Math.round(probability),
    riskLevel,
    factors
  };
}
