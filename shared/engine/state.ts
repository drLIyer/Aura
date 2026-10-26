import type { AppState } from './domain/types';

export function emptyState(): AppState {
  return {
    version: 1,
    profile: { sex: 'unspecified', conditions: [], familyHistory: [] },
    patterns: { triggers: [], customTriggers: [], alleviators: [], exacerbators: [], warningSigns: [] },
    medications: [],
    supplements: [],
    attacks: [],
    dailyLogs: [],
    periods: [],
    wearableSamples: [],
    midas: [],
  };
}

/** Fills in fields added since data was saved, so older records keep loading. */
export function normalize(raw: unknown): AppState {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState>;
  return {
    ...base,
    ...r,
    version: 1,
    profile: { ...base.profile, ...r.profile },
    patterns: { ...base.patterns, ...r.patterns },
  };
}
