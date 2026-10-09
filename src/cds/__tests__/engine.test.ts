import { describe, expect, it } from 'vitest';
import { addDays } from '../../domain/dates';
import type { AppState, Attack, Medication } from '../../domain/types';
import { demoState } from '../../storage/demo';
import { emptyState } from '../../storage/store';
import { evaluate } from '../engine';
import { relativeRisk, analyzeTriggers, menstrualPattern } from '../patterns';
import { overuseStatus } from '../rules';
import { backtest, fitRiskModel, forecast } from '../riskModel';
import { GUIDELINES } from '../../domain/guidelines';

const TODAY = '2026-10-09';

const attack = (date: string, extra: Partial<Attack> = {}): Attack => ({
  id: `a-${date}-${Math.random()}`,
  start: `${date}T10:00:00`,
  end: `${date}T18:00:00`,
  peakSeverity: 6,
  painLocations: [],
  painQualities: [],
  symptoms: [],
  worsenedByActivity: true,
  triggers: [],
  alleviators: [],
  exacerbators: [],
  doses: [],
  disability: 'mild',
  redFlags: [],
  ...extra,
});

const triptan: Medication = { id: 'trip', name: 'Sumatriptan', cls: 'triptan', role: 'acute', active: true };
const ibuprofen: Medication = { id: 'ibu', name: 'Ibuprofen', cls: 'nsaid', role: 'acute', active: true };

function withAttacks(attacks: Attack[], meds: Medication[] = [triptan, ibuprofen]): AppState {
  return { ...emptyState(), attacks, medications: meds };
}

describe('red flags', () => {
  it('raises an urgent recommendation for a thunderclap headache', () => {
    const recs = evaluate(withAttacks([attack(TODAY, { redFlags: ['thunderclap'] })]), TODAY);
    expect(recs[0].severity).toBe('urgent');
    expect(recs[0].sources).toContain('snnoop10');
  });

  it('flags aura longer than 60 minutes', () => {
    const recs = evaluate(withAttacks([attack(TODAY, { auraMinutes: 90 })]), TODAY);
    expect(recs.some((r) => r.id === 'prolonged-aura')).toBe(true);
  });
});

describe('medication overuse (ICHD-3 8.2)', () => {
  const triptanDays = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const d = addDays(TODAY, -i * 2);
      return attack(d, { doses: [{ medicationId: 'trip', takenAt: `${d}T10:30:00` }] });
    });

  it('counts triptan days against the 10-day limit', () => {
    expect(overuseStatus(withAttacks(triptanDays(10)), TODAY).overused).toEqual(['triptan']);
    expect(overuseStatus(withAttacks(triptanDays(9)), TODAY).overused).toEqual([]);
  });

  it('uses the 15-day limit for NSAIDs', () => {
    const nsaid = Array.from({ length: 12 }, (_, i) => {
      const d = addDays(TODAY, -i * 2);
      return attack(d, { doses: [{ medicationId: 'ibu', takenAt: `${d}T10:30:00` }] });
    });
    const s = overuseStatus(withAttacks(nsaid), TODAY);
    expect(s.overused).toEqual([]);
    expect(s.multipleClassOveruse).toBe(true); // ≥10 total acute days is still flagged
  });

  it('recommends a warning when over the limit', () => {
    const recs = evaluate(withAttacks(triptanDays(11)), TODAY);
    expect(recs.find((r) => r.id === 'moh')?.severity).toBe('warning');
  });
});

describe('prevention (AAN/AHS 2026)', () => {
  it('is offered at 4 migraine days a month without a preventive', () => {
    const recs = evaluate(withAttacks([0, 5, 10, 15].map((d) => attack(addDays(TODAY, -d)))), TODAY);
    expect(recs.some((r) => r.id === 'prevention-indicated')).toBe(true);
  });
  it('is not offered at 3 mild migraine days', () => {
    const recs = evaluate(withAttacks([0, 5, 10].map((d) => attack(addDays(TODAY, -d)))), TODAY);
    expect(recs.some((r) => r.id === 'prevention-indicated')).toBe(false);
  });
});

describe('interactions', () => {
  it('warns about combined hormonal contraception with aura', () => {
    const chc: Medication = { id: 'c', name: 'COC', cls: 'hormonal-contraceptive-combined', role: 'other', active: true };
    const recs = evaluate(withAttacks([attack(TODAY, { symptoms: ['aura-visual'] })], [chc]), TODAY);
    expect(recs.some((r) => r.id === 'chc-aura')).toBe(true);
  });
  it('warns about triptans with coronary disease', () => {
    const s = withAttacks([], [triptan]);
    s.profile.conditions = ['coronary-disease'];
    expect(evaluate(s, TODAY).some((r) => r.id === 'triptan-vascular')).toBe(true);
  });
});

describe('every recommendation cites the registry', () => {
  it('only uses known guideline ids', () => {
    const ids = new Set(GUIDELINES.map((g) => g.id));
    for (const r of evaluate(demoState(TODAY), TODAY)) {
      expect(r.sources.length).toBeGreaterThan(0);
      for (const s of r.sources) expect(ids.has(s), `${r.id} cites unknown ${s}`).toBe(true);
    }
  });
});

describe('pattern analysis', () => {
  it('computes relative risk with continuity correction', () => {
    const { rr } = relativeRisk(5, 10, 5, 50);
    expect(rr).toBeCloseTo((5.5 / 11) / (5.5 / 51), 5);
  });

  it('recovers the planted triggers in demo data', () => {
    const s = demoState(TODAY);
    const top = analyzeTriggers(s).filter((t) => t.relativeRisk > 1.5).map((t) => t.trigger);
    expect(top).toEqual(expect.arrayContaining(['late-meal', 'menstruation']));
    expect(menstrualPattern(s)?.cycles).toBeGreaterThanOrEqual(4);
  });
});

describe('risk model', () => {
  it('lets personal data override a strong self-reported belief', () => {
    const s = demoState(TODAY);
    const w = fitRiskModel(s).weights.get('chocolate');
    // The demo patient believes chocolate is a trigger but never logs it, so no data: belief stays.
    expect(w?.personalWeight).toBe(0);
    const lateMeal = fitRiskModel(s).weights.get('late-meal')!;
    expect(lateMeal.personalWeight).toBeGreaterThan(0.3);
    expect(lateMeal.rr).toBeGreaterThan(lateMeal.researchRR);
  });

  it('produces a forecast and a backtest that beats the base rate', () => {
    const s = demoState(TODAY);
    const f = forecast(s, TODAY);
    expect(f.probability).toBeGreaterThan(0);
    expect(f.probability).toBeLessThan(1);
    const bt = backtest(s, TODAY)!;
    expect(bt.days).toBeGreaterThan(30);
    expect(bt.brier).toBeLessThan(bt.brierBaseline);
  });

  it('works with no data at all', () => {
    const f = forecast(emptyState(), TODAY);
    expect(f.missing).toContain("today's check-in");
    expect(evaluate(emptyState(), TODAY).length).toBeGreaterThan(0);
  });
});
