import { AURA_SYMPTOMS } from '../domain/catalog';
import { addDays, dateRange, toISODate } from '../domain/dates';
import type { AppState, Attack, ISODate, Medication, MedicationClass, MidasAssessment } from '../domain/types';

/** All calendar dates an attack spans (an attack without an end counts for its start day). */
export function attackDates(attack: Attack): ISODate[] {
  const start = toISODate(attack.start);
  const end = attack.end ? toISODate(attack.end) : start;
  return end < start ? [start] : dateRange(start, end);
}

export const hasAura = (a: Attack): boolean =>
  (a.auraMinutes ?? 0) > 0 || a.symptoms.some((s) => AURA_SYMPTOMS.includes(s));

export interface Window {
  /** Inclusive. */
  from: ISODate;
  /** Inclusive. */
  to: ISODate;
}

/** The `days`-day window ending on `end`. */
export const windowEnding = (end: ISODate, days: number): Window => ({ from: addDays(end, -(days - 1)), to: end });

const inWindow = (d: ISODate, w: Window) => d >= w.from && d <= w.to;

export function migraineDays(attacks: Attack[], w: Window): Set<ISODate> {
  const days = new Set<ISODate>();
  for (const a of attacks) for (const d of attackDates(a)) if (inWindow(d, w)) days.add(d);
  return days;
}

/** Migraine days with moderate-to-severe pain (≥4 on a 0–10 scale). */
export function moderateSevereDays(attacks: Attack[], w: Window): Set<ISODate> {
  return migraineDays(
    attacks.filter((a) => a.peakSeverity >= 4),
    w,
  );
}

/** Any headache: logged attacks plus daily check-ins that recorded a headache. */
export function headacheDays(state: Pick<AppState, 'attacks' | 'dailyLogs'>, w: Window): Set<ISODate> {
  const days = migraineDays(state.attacks, w);
  for (const log of state.dailyLogs) if (log.headache && inWindow(log.date, w)) days.add(log.date);
  return days;
}

/** For each medication class, the set of days in the window on which it was taken. */
export function acuteMedicationDays(
  attacks: Attack[],
  medications: Medication[],
  w: Window,
): Map<MedicationClass, Set<ISODate>> {
  const byId = new Map(medications.map((m) => [m.id, m]));
  const result = new Map<MedicationClass, Set<ISODate>>();
  for (const a of attacks) {
    for (const dose of a.doses) {
      const med = byId.get(dose.medicationId);
      if (!med) continue;
      const day = toISODate(dose.takenAt);
      if (!inWindow(day, w)) continue;
      if (!result.has(med.cls)) result.set(med.cls, new Set());
      result.get(med.cls)!.add(day);
    }
  }
  return result;
}

export function midasScore(m: MidasAssessment): number {
  return m.answers.reduce((s, n) => s + n, 0);
}

export function midasGrade(score: number): { grade: 'I' | 'II' | 'III' | 'IV'; label: string } {
  if (score <= 5) return { grade: 'I', label: 'Little or no disability' };
  if (score <= 10) return { grade: 'II', label: 'Mild disability' };
  if (score <= 20) return { grade: 'III', label: 'Moderate disability' };
  return { grade: 'IV', label: 'Severe disability' };
}

export function latestMidas(state: Pick<AppState, 'midas'>): MidasAssessment | undefined {
  return [...state.midas].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export interface SummaryStats {
  migraineDays: number;
  moderateSevereDays: number;
  headacheDays: number;
  acuteMedicationDays: number;
  attacks: number;
  meanSeverity: number | null;
}

export function summarize(state: AppState, w: Window): SummaryStats {
  const attacks = state.attacks.filter((a) => attackDates(a).some((d) => inWindow(d, w)));
  const medDays = new Set<ISODate>();
  for (const days of acuteMedicationDays(state.attacks, state.medications, w).values()) for (const d of days) medDays.add(d);
  return {
    migraineDays: migraineDays(state.attacks, w).size,
    moderateSevereDays: moderateSevereDays(state.attacks, w).size,
    headacheDays: headacheDays(state, w).size,
    acuteMedicationDays: medDays.size,
    attacks: attacks.length,
    meanSeverity: attacks.length ? attacks.reduce((s, a) => s + a.peakSeverity, 0) / attacks.length : null,
  };
}
