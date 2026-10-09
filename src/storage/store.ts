import type { AppState } from '../domain/types';

/**
 * All patient data stays in this browser's localStorage. Nothing is sent anywhere unless the
 * patient connects a wearable gateway or exports a file themselves.
 */
const KEY = 'aura:v1';

export function emptyState(): AppState {
  return {
    version: 1,
    profile: { sex: 'unspecified', conditions: [], familyHistory: [] },
    patterns: { triggers: [], customTriggers: [], alleviators: [], exacerbators: [], warningSigns: [] },
    medications: [],
    supplements: [],
    attacks: [],
    dailyLogs: [],
    wearableSamples: [],
    midas: [],
  };
}

/** Fills in fields added since the data was saved, so older exports keep loading. */
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

export function loadState(): AppState {
  try {
    const text = localStorage.getItem(KEY);
    return text ? normalize(JSON.parse(text)) : emptyState();
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Could not save Aura data', err);
  }
}

export function exportJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importJson(text: string): AppState {
  return normalize(JSON.parse(text));
}

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
