import type { IStorage, WearableSampleRecord } from "./storage";

/**
 * Client for a self-hosted Open Wearables gateway (https://github.com/the-momentum/open-wearables),
 * which connects Oura, Fitbit, Garmin, Whoop, Polar, Suunto, Withings, Apple Health and others
 * behind one API. The API key stays on this server; the browser never sees it.
 *
 * Configure with OPEN_WEARABLES_URL (e.g. http://localhost:8000) and OPEN_WEARABLES_API_KEY.
 * Field names follow the gateway's OpenAPI spec (docs/openapi.json in that repository).
 */

export const PROVIDER = "open-wearables";

/** Shown when the gateway's provider list can't be fetched. */
export const DEFAULT_PROVIDERS = ["oura", "fitbit", "garmin", "whoop", "polar", "suunto", "withings", "ultrahuman"];

export function isConfigured(env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {}): boolean {
  return Boolean(env.OPEN_WEARABLES_URL && env.OPEN_WEARABLES_API_KEY);
}

type Fetch = typeof fetch;

export class OpenWearablesClient {
  constructor(
    private baseUrl = typeof process !== "undefined" ? process.env.OPEN_WEARABLES_URL! : "",
    private apiKey = typeof process !== "undefined" ? process.env.OPEN_WEARABLES_API_KEY! : "",
    private fetchImpl: Fetch = fetch,
  ) {}

  private async request<T>(method: string, path: string, query?: Record<string, string | undefined>, body?: unknown): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url, {
      method,
      headers: { "X-Open-Wearables-API-Key": this.apiKey, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Open Wearables ${method} ${url.pathname} failed: ${res.status}`);
    return (await res.json()) as T;
  }

  async listProviders(): Promise<string[]> {
    const data = await this.request<unknown>("GET", "/api/v1/oauth/providers");
    const items = Array.isArray(data) ? data : ((data as { providers?: unknown[] })?.providers ?? []);
    const names = items
      .map((p) => (typeof p === "string" ? p : ((p as { name?: string; provider?: string }).provider ?? (p as { name?: string }).name)))
      .filter((p): p is string => typeof p === "string");
    return names.length ? names : DEFAULT_PROVIDERS;
  }

  async createUser(): Promise<string> {
    const user = await this.request<{ id: string }>("POST", "/api/v1/users", undefined, {});
    return user.id;
  }

  async authorizationUrl(provider: string, owUserId: string, redirectUri: string): Promise<string> {
    const res = await this.request<{ authorization_url: string }>("GET", `/api/v1/oauth/${encodeURIComponent(provider)}/authorize`, {
      user_id: owUserId,
      redirect_uri: redirectUri,
    });
    return res.authorization_url;
  }

  async connections(owUserId: string): Promise<{ provider: string; status: string; last_synced_at?: string | null }[]> {
    return this.request("GET", `/api/v1/users/${encodeURIComponent(owUserId)}/connections`);
  }

  /** Follows cursor pagination ({ data, pagination: { next_cursor, has_more } }). */
  async paginate<T>(path: string, query: Record<string, string>): Promise<T[]> {
    const out: T[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 50; page++) {
      const res = await this.request<{ data: T[]; pagination?: { next_cursor?: string | null; has_more?: boolean } }>("GET", path, {
        ...query,
        limit: "100",
        cursor,
      });
      out.push(...(res.data ?? []));
      if (!res.pagination?.has_more || !res.pagination.next_cursor) break;
      cursor = res.pagination.next_cursor;
    }
    return out;
  }
}

// ---------------------------------------------------------------------------------------
// Normalisation from Open Wearables summaries to Aura's daily samples

interface SourceMeta {
  provider?: string;
  name?: string;
}
export interface SleepSummary {
  date: string;
  source?: SourceMeta;
  duration_minutes?: number | null;
  efficiency_percent?: number | null;
  avg_hrv_rmssd_ms?: number | null;
  avg_hrv_sdnn_ms?: number | null;
  avg_spo2_percent?: number | null;
}
export interface RecoverySummary {
  date: string;
  source?: SourceMeta;
  sleep_duration_seconds?: number | null;
  resting_heart_rate_bpm?: number | null;
  avg_hrv_rmssd_ms?: number | null;
  avg_hrv_sdnn_ms?: number | null;
  avg_spo2_percent?: number | null;
  recovery_score?: number | null;
}
export interface ActivitySummary {
  date: string;
  source?: SourceMeta;
  steps?: number | null;
}

export interface TimeSeriesSample {
  timestamp: string;
  value: number;
  /** The gateway reports local offsets separately; the timestamp's own date is the user's day. */
  zone_offset?: string | null;
  source?: SourceMeta;
}

/** Averages time-series readings into one value per calendar day and source. Negative values (no reading) are skipped. */
export function dailyMeans(series: TimeSeriesSample[], metric: string): WearableSampleRecord[] {
  const acc = new Map<string, { sum: number; n: number; date: string; source: string }>();
  for (const s of series) {
    if (!Number.isFinite(s.value) || s.value < 0) continue;
    const date = s.timestamp.slice(0, 10);
    const source = sourceName(s.source);
    const key = `${date}|${source}`;
    const e = acc.get(key) ?? { sum: 0, n: 0, date, source };
    e.sum += s.value;
    e.n += 1;
    acc.set(key, e);
  }
  return [...acc.values()].map((e) => ({ date: e.date, metric, value: Math.round(e.sum / e.n), source: e.source }));
}

const sourceName = (s?: SourceMeta) => (s?.provider ?? s?.name ?? PROVIDER).toString().toLowerCase();

export function normalizeSummaries(sleep: SleepSummary[], recovery: RecoverySummary[], activity: ActivitySummary[]): WearableSampleRecord[] {
  const out = new Map<string, WearableSampleRecord>();
  const add = (date: string, metric: string, value: number | null | undefined, source: string) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    // The first value seen for a day/metric/source wins (sleep summaries are added first).
    const key = `${date}|${metric}|${source}`;
    if (!out.has(key)) out.set(key, { date: date.slice(0, 10), metric, value, source });
  };
  for (const s of sleep) {
    const src = sourceName(s.source);
    add(s.date, "sleepMinutes", s.duration_minutes, src);
    add(s.date, "hrvRmssd", s.avg_hrv_rmssd_ms, src);
    add(s.date, "hrvSdnn", s.avg_hrv_sdnn_ms, src);
    add(s.date, "spo2", s.avg_spo2_percent, src);
  }
  for (const r of recovery) {
    const src = sourceName(r.source);
    add(r.date, "restingHeartRate", r.resting_heart_rate_bpm, src);
    add(r.date, "hrvRmssd", r.avg_hrv_rmssd_ms, src);
    add(r.date, "hrvSdnn", r.avg_hrv_sdnn_ms, src);
    add(r.date, "spo2", r.avg_spo2_percent, src);
    add(r.date, "sleepMinutes", r.sleep_duration_seconds != null ? r.sleep_duration_seconds / 60 : null, src);
    add(r.date, "readinessScore", r.recovery_score, src);
  }
  for (const a of activity) add(a.date, "steps", a.steps, sourceName(a.source));
  return [...out.values()];
}

/** Pulls recent daily summaries for one Aura user and stores them as wearable samples. */
export async function syncUser(client: OpenWearablesClient, storage: IStorage, userId: string, from: string, to: string): Promise<number> {
  const link = await storage.getIntegration(userId, PROVIDER);
  if (!link) throw new Error("No wearable account connected yet");
  const base = `/api/v1/users/${encodeURIComponent(link.externalUserId)}/summaries`;
  const range = { start_date: from, end_date: to };
  const [sleep, recovery, activity] = await Promise.all([
    client.paginate<SleepSummary>(`${base}/sleep`, range),
    client.paginate<RecoverySummary>(`${base}/recovery`, range),
    client.paginate<ActivitySummary>(`${base}/activity`, range),
  ]);
  const samples = normalizeSummaries(sleep, recovery, activity);
  // Garmin's stress level (0–100, higher = more stress) only exists as a time series: average it per day.
  try {
    const stress = await client.paginate<TimeSeriesSample>(`/api/v1/users/${encodeURIComponent(link.externalUserId)}/timeseries`, {
      start_time: `${from}T00:00:00`,
      end_time: `${to}T23:59:59`,
      types: "garmin_stress_level",
      resolution: "1hour",
    });
    samples.push(...dailyMeans(stress, "stressLevel"));
  } catch (err) {
    console.error("[aura] stress time series unavailable:", (err as Error).message);
  }
  await storage.upsertWearableSamples(userId, samples);
  await storage.saveIntegration(userId, { ...link, lastSyncedAt: new Date() });
  return samples.length;
}
