import type { AppState, ISODate, Recommendation, Severity } from '../domain/types';
import { RULES, type RuleContext } from './rules';

const ORDER: Record<Severity, number> = { urgent: 0, warning: 1, info: 2, positive: 3 };

/**
 * Runs every decision-support rule against the patient's data. Rules are pure functions,
 * so the output depends only on `state` and `today`.
 */
export function evaluate(state: AppState, today: ISODate): Recommendation[] {
  const ctx: RuleContext = { state, today, activeMeds: state.medications.filter((m) => m.active) };
  const out: Recommendation[] = [];
  for (const rule of RULES) {
    try {
      out.push(...rule(ctx));
    } catch (err) {
      // One faulty rule must not hide the others, least of all a safety rule.
      console.error('CDS rule failed', rule.name, err);
    }
  }
  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
