import { addDays, parseISODate, toISODate } from '../domain/dates';
import type { AppState, Attack, DailyLog, Medication, WearableSample } from '../domain/types';

/** Deterministic PRNG so demo data (and tests that use it) are reproducible. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A fictional patient whose attacks follow a few planted patterns (periods, late lunch,
 * short sleep, conflict, long work days), so every screen and rule has something to show.
 */
export function demoState(today: string = toISODate(new Date()), days = 120): AppState {
  const rnd = mulberry32(42);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

  const meds: Medication[] = [
    { id: 'm-suma', name: 'Sumatriptan', cls: 'triptan', role: 'acute', dose: '50 mg', active: true },
    { id: 'm-ibu', name: 'Ibuprofen', cls: 'nsaid', role: 'acute', dose: '400 mg', active: true },
    { id: 'm-sert', name: 'Sertraline', cls: 'ssri', role: 'other', dose: '50 mg daily', active: true },
  ];

  const start = addDays(today, -(days - 1));
  const logs: DailyLog[] = [];
  const attacks: Attack[] = [];
  const samples: WearableSample[] = [];
  const cycleLength = 28;
  let nextAttackAllowed = start;

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const dow = parseISODate(date).getDay();
    const cycleDay = (i + 9) % cycleLength;
    const menstruating = cycleDay < 5;
    const sleepHours = Math.round((7.2 + (rnd() - 0.5) * 2.4 - (rnd() < 0.15 ? 1.8 : 0)) * 2) / 2;
    const workHours = dow === 0 || dow === 6 ? 0 : Math.round(8 + rnd() * 3.5);
    const lateLunch = dow > 0 && dow < 6 && rnd() < 0.22;
    const conflict = rnd() < 0.06;
    const stress = Math.min(10, Math.round(3 + rnd() * 4 + (workHours >= 10 ? 2 : 0) + (conflict ? 3 : 0)));
    const exposures: string[] = [];
    if (menstruating) exposures.push('menstruation');
    if (conflict) exposures.push('conflict');
    if (rnd() < 0.08) exposures.push('alcohol');
    if (rnd() < 0.1) exposures.push('weather');
    if (rnd() < 0.05) exposures.push('skipped-meal');

    const sleepScore = Math.round(Math.min(98, Math.max(40, 55 + (sleepHours - 5) * 11 + (rnd() - 0.5) * 10)));
    const readiness = Math.round(Math.min(98, Math.max(35, sleepScore - 5 + (rnd() - 0.5) * 16 - (stress >= 7 ? 8 : 0))));
    const rhr = Math.round(58 + (80 - readiness) / 6 + (rnd() - 0.5) * 3);
    const hrv = Math.round(48 - (80 - readiness) / 3 + (rnd() - 0.5) * 8);

    // Planted relative risks: period ×3, late lunch ×2.5, short sleep ×2, conflict ×3, long day ×1.8.
    let risk = 0.08;
    if (cycleDay >= cycleLength - 2 || cycleDay <= 2) risk *= 3;
    if (lateLunch) risk *= 2.5;
    if (sleepHours < 6) risk *= 2;
    if (conflict) risk *= 3;
    if (workHours >= 10) risk *= 1.8;
    const attackToday = date >= nextAttackAllowed && rnd() < Math.min(risk, 0.85);
    const warning = attackToday && rnd() < 0.5 ? [pick(['yawning', 'neck-stiffness', 'fatigue', 'mood-change'])] : [];

    logs.push({
      date,
      sleepHours,
      sleepQuality: sleepHours < 6 ? 2 : sleepHours < 7 ? 3 : 4,
      stress,
      caffeineMg: pick([100, 150, 200, 200, 250]),
      waterLiters: Math.round((1.2 + rnd()) * 10) / 10,
      lunchTime: lateLunch ? pick(['15:15', '15:30', '16:00']) : dow === 0 || dow === 6 ? undefined : pick(['12:15', '12:30', '13:00']),
      workHours: workHours || undefined,
      sleepScore,
      readinessScore: readiness,
      exposures,
      warningSigns: warning,
      headache: attackToday,
    });
    samples.push(
      { date, metric: 'sleepMinutes', value: Math.round(sleepHours * 60), source: 'demo-ring' },
      { date, metric: 'sleepScore', value: sleepScore, source: 'demo-ring' },
      { date, metric: 'readinessScore', value: readiness, source: 'demo-ring' },
      { date, metric: 'restingHeartRate', value: rhr, source: 'demo-ring' },
      { date, metric: 'hrvRmssd', value: hrv, source: 'demo-ring' },
      { date, metric: 'steps', value: Math.round(4000 + rnd() * 7000), source: 'demo-ring' },
    );

    if (attackToday) {
      const startHour = lateLunch ? 15 : pick([7, 10, 14, 17, 20]);
      const startTs = new Date(parseISODate(date).getTime() + startHour * 3_600_000 + Math.floor(rnd() * 60) * 60_000);
      const duration = 4 + rnd() * 30;
      const severity = Math.min(10, Math.round(4 + rnd() * 5 + (cycleDay <= 2 ? 1 : 0)));
      const useTriptan = severity >= 6 || rnd() < 0.5;
      const delayMin = 20 + Math.floor(rnd() * 120);
      const doseAt = new Date(startTs.getTime() + delayMin * 60_000).toISOString();
      const triggers = [
        ...(cycleDay >= cycleLength - 2 || cycleDay <= 2 ? ['menstruation'] : []),
        ...(lateLunch ? ['late-meal'] : []),
        ...(sleepHours < 6 ? ['poor-sleep'] : []),
        ...(conflict ? ['conflict'] : []),
        ...(workHours >= 10 ? ['long-workday'] : []),
      ];
      attacks.push({
        id: `a-${date}`,
        start: startTs.toISOString(),
        end: new Date(startTs.getTime() + duration * 3_600_000).toISOString(),
        peakSeverity: severity,
        painLocations: [pick(['left', 'right', 'bilateral']), 'temple'],
        painQualities: ['throbbing'],
        symptoms: ['photophobia', 'phonophobia', ...(rnd() < 0.6 ? ['nausea'] : []), ...(rnd() < 0.15 ? ['aura-visual'] : [])],
        auraMinutes: undefined,
        worsenedByActivity: rnd() < 0.8,
        triggers,
        alleviators: ['dark-room', ...(rnd() < 0.5 ? ['sleep'] : []), ...(rnd() < 0.4 ? ['cold-compress'] : [])],
        exacerbators: ['light', 'noise', ...(rnd() < 0.5 ? ['movement'] : [])],
        doses: [
          {
            medicationId: useTriptan ? 'm-suma' : 'm-ibu',
            takenAt: doseAt,
            reliefAt2h: useTriptan ? (rnd() < 0.65 ? 'pain-free' : 'partial') : rnd() < 0.3 ? 'partial' : 'none',
            recurrence: useTriptan && rnd() < 0.2,
          },
        ],
        disability: severity >= 8 ? 'severe' : severity >= 6 ? 'moderate' : 'mild',
        redFlags: [],
      });
      nextAttackAllowed = addDays(date, Math.floor(duration / 24) + 1);
    }
  }

  return {
    version: 1,
    profile: { name: 'Demo patient', birthYear: 1990, sex: 'female', childbearingPotential: true, conditions: [], migraineOnsetYear: 2006 },
    patterns: {
      completedAt: new Date(parseISODate(start)).toISOString(),
      typicalMigraineDaysPerMonth: 5,
      typicalDurationHours: 12,
      yearsWithMigraine: 20,
      triggers: [
        { id: 'menstruation', likelihood: 'often', strategy: 'Track my cycle; keep medication with me in that week' },
        { id: 'late-meal', likelihood: 'often', strategy: 'Calendar block for lunch at 12:30' },
        { id: 'poor-sleep', likelihood: 'sometimes' },
        { id: 'conflict', likelihood: 'often', strategy: 'Step away and breathe before responding' },
        { id: 'long-workday', likelihood: 'sometimes' },
        { id: 'chocolate', likelihood: 'sometimes' },
      ],
      customTriggers: [],
      alleviators: ['dark-room', 'sleep', 'cold-compress'],
      exacerbators: ['light', 'noise', 'movement'],
      warningSigns: ['yawning', 'neck-stiffness'],
    },
    medications: meds,
    supplements: [{ id: 's-mag', kind: 'magnesium', name: 'Magnesium glycinate', dailyMg: 200, active: true }],
    attacks,
    dailyLogs: logs,
    wearableSamples: samples,
    midas: [{ date: addDays(today, -40), answers: [2, 4, 1, 5, 2] }],
  };
}
