import { z, ZodError } from "zod";
import {
  attackInput,
  dailyLogInput,
  dateQuery,
  isoDate,
  mealInput,
  medicationInput,
  midasInput,
  periodImport,
  periodInput,
  profileUpdate,
  supplementInput,
  supplementIntakeInput,
  waterInput,
  wearableImport,
} from "@shared/api";
import { evaluate } from "@shared/engine/cds/engine";
import { acuteMedicationDays, hasAura, latestMidas, midasGrade, midasScore, summarize, windowEnding } from "@shared/engine/cds/metrics";
import { compareMetrics, cycleStatus, frequency, inPerimenstrualWindow, menstrualPattern, primarySource, scoreBands, suggestThreshold, thresholdsFor } from "@shared/engine/cds/patterns";
import { backtest, fitRiskModel, forecast } from "@shared/engine/cds/riskModel";
import { medicationResponses, overuseStatus } from "@shared/engine/cds/rules";
import { addDays, dateRange } from "@shared/engine/domain/dates";
import { CONDITIONS, FAMILY_HISTORY, labelOf } from "@shared/engine/domain/catalog";
import type { AppState, Recommendation } from "@shared/engine/domain/types";
import { demoState } from "@shared/engine/demo";
import { buildAssistContext, buildCaptureContext } from "@shared/assist/context";
import { RuleProvider } from "@shared/assist/ruleProvider";
import { sanitizeProposal } from "@shared/assist/sanitize";
import { screenText } from "@shared/assist/safetyScreen";
import { lifeEventInput, type AssistProvider } from "@shared/assist/types";
import { localDateTime as localDateTimeInput } from "@shared/api";
import { buildAppState } from "./engineState";
import { convertToCSV, generateMLDataset } from "./mlExport";
import { DEFAULT_PROVIDERS, isConfigured as wearablesConfigured, OpenWearablesClient, PROVIDER, syncUser } from "./openWearables";
import type { IStorage } from "./storage";
import { isValidTimeZone, localDate, localDateTime } from "./time";

/**
 * The API, independent of the web framework. Express serves it on the real server (routes.ts);
 * the browser-only demo serves the very same routes from inside the page (client/src/demo).
 * Handlers only use the small request/response surface below, which Express already provides.
 */
export interface Request {
  userId?: string;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  protocol: string;
  header(name: string): string | undefined;
  get(name: string): string | undefined;
}
export interface Response {
  status(code: number): Response;
  json(body: unknown): unknown;
  send(body: string): unknown;
  end(): unknown;
  setHeader(name: string, value: string): unknown;
}
export type NextFunction = (err?: unknown) => void;
type RouteHandler = (req: Request, res: Response, next: NextFunction) => void;
export interface Router {
  get(path: string, handler: RouteHandler): unknown;
  post(path: string, handler: RouteHandler): unknown;
  put(path: string, handler: RouteHandler): unknown;
  delete(path: string, handler: RouteHandler): unknown;
}

type Handler = (req: Request, res: Response) => Promise<unknown>;

/** Runs an async handler; invalid input becomes 400 with the reasons, never a crash. */
const handle = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch((err) => {
    if (err instanceof ZodError) {
      res.status(400).json({ message: "Invalid input", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      return;
    }
    next(err);
  });
};

const idParam = z.object({ id: z.string().min(1).max(80) });
const audienceQuery = z.object({ audience: z.enum(["patient", "clinician"]).default("patient") });
const daysQuery = z.object({ days: z.coerce.number().int().min(1).max(400).default(30) });

export interface ApiOptions {
  storage: IStorage;
  /** Only development sign-in and the browser demo may load demo data. */
  allowDemo: boolean;
  /** Lets tests replace the gateway client. */
  wearablesClient?: () => OpenWearablesClient;
  /** The assistant: Claude when a key is configured, otherwise fixed rules (basic mode). */
  assistant?: AssistProvider;
}

/** Registers every /api route. The caller must already have authenticated the request (req.userId). */
export function registerApi(app: Router, { storage, allowDemo, wearablesClient, assistant = new RuleProvider() }: ApiOptions): void {
  const owClient = wearablesClient ?? (() => new OpenWearablesClient());
  const basic = new RuleProvider();

  const uid = (req: Request) => req.userId!;

  /** The user's own calendar date: explicit ?date=, else their time zone (header, then profile), else UTC. */
  async function today(req: Request): Promise<string> {
    const { date } = dateQuery.parse(req.query);
    if (date) return date;
    const header = req.header("x-timezone");
    if (isValidTimeZone(header)) return localDate(new Date(), header);
    const { timezone } = await storage.getProfile(uid(req));
    return localDate(new Date(), isValidTimeZone(timezone) ? timezone : "UTC");
  }

  async function stateFor(req: Request): Promise<{ state: AppState; date: string }> {
    const date = await today(req);
    return { state: await buildAppState(storage, uid(req), date), date };
  }

  const forAudience = (recs: Recommendation[], audience: "patient" | "clinician") =>
    audience === "clinician" ? recs : recs.filter((r) => (r.audience ?? "both") !== "clinician");

  // ---------------------------------------------------------------- Profile & intake

  app.get("/api/profile", handle(async (req, res) => res.json(await storage.getProfile(uid(req)))));

  app.put(
    "/api/profile",
    handle(async (req, res) => {
      const body = profileUpdate.parse(req.body);
      if (body.timezone && !isValidTimeZone(body.timezone)) return res.status(400).json({ message: "Unknown time zone" });
      res.json(await storage.saveProfile(uid(req), body));
    }),
  );

  // ---------------------------------------------------------------- Medications & supplements

  app.get("/api/medications", handle(async (req, res) => res.json(await storage.listMedications(uid(req)))));
  app.post("/api/medications", handle(async (req, res) => res.status(201).json(await storage.createMedication(uid(req), medicationInput.parse(req.body)))));
  app.put(
    "/api/medications/:id",
    handle(async (req, res) => {
      const row = await storage.updateMedication(uid(req), idParam.parse(req.params).id, medicationInput.parse(req.body));
      return row ? res.json(row) : res.status(404).json({ message: "Not found" });
    }),
  );
  app.delete(
    "/api/medications/:id",
    handle(async (req, res) => res.status((await storage.deleteMedication(uid(req), idParam.parse(req.params).id)) ? 204 : 404).end()),
  );

  app.get("/api/supplements", handle(async (req, res) => res.json(await storage.listSupplements(uid(req)))));
  app.post("/api/supplements", handle(async (req, res) => res.status(201).json(await storage.createSupplement(uid(req), supplementInput.parse(req.body)))));
  app.put(
    "/api/supplements/:id",
    handle(async (req, res) => {
      const row = await storage.updateSupplement(uid(req), idParam.parse(req.params).id, supplementInput.parse(req.body));
      return row ? res.json(row) : res.status(404).json({ message: "Not found" });
    }),
  );
  app.delete(
    "/api/supplements/:id",
    handle(async (req, res) => res.status((await storage.deleteSupplement(uid(req), idParam.parse(req.params).id)) ? 204 : 404).end()),
  );

  // ---------------------------------------------------------------- Attacks

  app.get("/api/attacks", handle(async (req, res) => res.json(await storage.listAttacks(uid(req)))));
  app.post("/api/attacks", handle(async (req, res) => res.status(201).json(await storage.createAttack(uid(req), attackInput.parse(req.body)))));
  app.put(
    "/api/attacks/:id",
    handle(async (req, res) => {
      const row = await storage.updateAttack(uid(req), idParam.parse(req.params).id, attackInput.parse(req.body));
      return row ? res.json(row) : res.status(404).json({ message: "Not found" });
    }),
  );
  app.delete(
    "/api/attacks/:id",
    handle(async (req, res) => res.status((await storage.deleteAttack(uid(req), idParam.parse(req.params).id)) ? 204 : 404).end()),
  );

  // ---------------------------------------------------------------- Daily check-ins

  app.get(
    "/api/checkins",
    handle(async (req, res) => {
      const date = await today(req);
      const { days } = daysQuery.parse(req.query);
      res.json(await storage.listDailyLogs(uid(req), addDays(date, -(days - 1)), date));
    }),
  );
  app.get(
    "/api/checkins/:date",
    handle(async (req, res) => {
      const date = isoDate.parse(req.params.date);
      const [log] = await storage.listDailyLogs(uid(req), date, date);
      res.json(log ?? null);
    }),
  );
  app.put(
    "/api/checkins/:date",
    handle(async (req, res) => res.json(await storage.upsertDailyLog(uid(req), isoDate.parse(req.params.date), dailyLogInput.parse(req.body)))),
  );

  // ---------------------------------------------------------------- Quick logs

  app.get("/api/water", handle(async (req, res) => res.json(await storage.listWater(uid(req), await today(req)))));
  app.post(
    "/api/water",
    handle(async (req, res) => {
      const b = waterInput.parse(req.body);
      res.status(201).json(await storage.addWater(uid(req), b.amount, b.localDate));
    }),
  );
  app.delete("/api/water/:id", handle(async (req, res) => res.status((await storage.deleteWater(uid(req), idParam.parse(req.params).id)) ? 204 : 404).end()));

  app.get("/api/meals", handle(async (req, res) => res.json(await storage.listMeals(uid(req), await today(req)))));
  app.post(
    "/api/meals",
    handle(async (req, res) => {
      const b = mealInput.parse(req.body);
      res.status(201).json(await storage.addMeal(uid(req), b.type, b.localDate, b.localTime));
    }),
  );
  app.delete("/api/meals/:id", handle(async (req, res) => res.status((await storage.deleteMeal(uid(req), idParam.parse(req.params).id)) ? 204 : 404).end()));

  app.get("/api/supplement-intake", handle(async (req, res) => res.json(await storage.listSupplementIntake(uid(req), await today(req)))));
  app.post(
    "/api/supplement-intake",
    handle(async (req, res) => {
      const b = supplementIntakeInput.parse(req.body);
      res.status(201).json(await storage.addSupplementIntake(uid(req), b.name, b.dosage, b.localDate));
    }),
  );
  app.delete(
    "/api/supplement-intake/:id",
    handle(async (req, res) => res.status((await storage.deleteSupplementIntake(uid(req), idParam.parse(req.params).id)) ? 204 : 404).end()),
  );

  // ---------------------------------------------------------------- Periods

  app.get("/api/cycle", handle(async (req, res) => res.json(await storage.listPeriods(uid(req)))));
  app.post(
    "/api/cycle",
    handle(async (req, res) => {
      const p = periodInput.parse(req.body);
      const added = await storage.addPeriods(uid(req), [p]);
      res.status(added ? 201 : 200).json({ added });
    }),
  );
  app.post(
    "/api/cycle/import",
    handle(async (req, res) => {
      const { entries } = periodImport.parse(req.body);
      const added = await storage.addPeriods(uid(req), entries);
      res.json({ added, skipped: entries.length - added });
    }),
  );
  app.delete("/api/cycle/:id", handle(async (req, res) => res.status((await storage.deletePeriod(uid(req), idParam.parse(req.params).id)) ? 204 : 404).end()));
  app.get(
    "/api/cycle/current",
    handle(async (req, res) => {
      const { state, date } = await stateFor(req);
      res.json(cycleStatus(state, date));
    }),
  );

  // ---------------------------------------------------------------- MIDAS

  app.get("/api/midas", handle(async (req, res) => res.json(await storage.listMidas(uid(req)))));
  app.post(
    "/api/midas",
    handle(async (req, res) => {
      const b = midasInput.parse(req.body);
      res.status(201).json(await storage.addMidas(uid(req), b.date, b.answers));
    }),
  );

  // ---------------------------------------------------------------- Decision support

  app.get(
    "/api/forecast",
    handle(async (req, res) => {
      const { state, date } = await stateFor(req);
      res.json(forecast(state, date));
    }),
  );

  app.get(
    "/api/recommendations",
    handle(async (req, res) => {
      const { audience } = audienceQuery.parse(req.query);
      const { state, date } = await stateFor(req);
      res.json(forAudience(evaluate(state, date), audience));
    }),
  );

  app.get(
    "/api/trends",
    handle(async (req, res) => {
      const { days } = daysQuery.parse(req.query);
      const { state, date } = await stateFor(req);
      const logs = new Map(state.dailyLogs.map((l) => [l.date, l]));
      const onsets = new Set(state.attacks.map((a) => a.start.slice(0, 10)));
      res.json(
        dateRange(addDays(date, -(days - 1)), date).map((d) => ({
          date: d,
          readiness: logs.get(d)?.readinessScore ?? null,
          sleep: logs.get(d)?.sleepScore ?? null,
          stress: logs.get(d)?.stress ?? null,
          migraine: onsets.has(d) ? 1 : 0,
        })),
      );
    }),
  );

  app.get(
    "/api/insights",
    handle(async (req, res) => {
      const { state, date } = await stateFor(req);
      res.json(buildInsights(state, date));
    }),
  );

  app.get(
    "/api/report",
    handle(async (req, res) => {
      const { state, date } = await stateFor(req);
      res.json(buildReport(state, date));
    }),
  );

  // ---------------------------------------------------------------- Wearables

  app.get(
    "/api/wearables/status",
    handle(async (req, res) => {
      const link = await storage.getIntegration(uid(req), PROVIDER);
      const configured = wearablesConfigured();
      let connections: { provider: string; status: string }[] = [];
      if (configured && link) {
        try {
          connections = await owClient().connections(link.externalUserId);
        } catch (err) {
          console.error("[aura] Open Wearables connections failed:", (err as Error).message);
        }
      }
      res.json({ configured, linked: Boolean(link), lastSyncedAt: link?.lastSyncedAt ?? null, connections });
    }),
  );

  app.get(
    "/api/wearables/providers",
    handle(async (_req, res) => {
      if (!wearablesConfigured()) return res.json(DEFAULT_PROVIDERS);
      try {
        res.json(await owClient().listProviders());
      } catch {
        res.json(DEFAULT_PROVIDERS);
      }
    }),
  );

  app.post(
    "/api/wearables/connect",
    handle(async (req, res) => {
      if (!wearablesConfigured()) return res.status(503).json({ message: "The wearable gateway is not configured on this server." });
      const { provider } = z.object({ provider: z.string().regex(/^[a-z0-9_-]{2,40}$/) }).parse(req.body);
      const client = owClient();
      let link = await storage.getIntegration(uid(req), PROVIDER);
      if (!link) {
        link = { provider: PROVIDER, externalUserId: await client.createUser(), lastSyncedAt: null };
        await storage.saveIntegration(uid(req), link);
      }
      const redirect = `${req.protocol}://${req.get("host")}/?view=wearables&connected=${provider}`;
      res.json({ url: await client.authorizationUrl(provider, link.externalUserId, redirect) });
    }),
  );

  app.post(
    "/api/wearables/sync",
    handle(async (req, res) => {
      if (!wearablesConfigured()) return res.status(503).json({ message: "The wearable gateway is not configured on this server." });
      const date = await today(req);
      const count = await syncUser(owClient(), storage, uid(req), addDays(date, -60), date);
      res.json({ samples: count });
    }),
  );

  app.post(
    "/api/wearables/import",
    handle(async (req, res) => {
      const { source, samples } = wearableImport.parse(req.body);
      const count = await storage.upsertWearableSamples(uid(req), samples.map((s) => ({ ...s, source })));
      res.json({ samples: count });
    }),
  );

  app.get(
    "/api/wearables/samples",
    handle(async (req, res) => {
      const { days } = daysQuery.parse(req.query);
      res.json(await storage.listWearableSamples(uid(req), addDays(await today(req), -(days - 1))));
    }),
  );

  // ---------------------------------------------------------------- Export & deletion

  app.get(
    "/api/export/ml-data",
    handle(async (req, res) => {
      const { state, date } = await stateFor(req);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=aura_ml_data.csv");
      res.send(convertToCSV(generateMLDataset(state, date)));
    }),
  );

  app.get(
    "/api/export/json",
    handle(async (req, res) => {
      const { state } = await stateFor(req);
      res.setHeader("Content-Disposition", "attachment; filename=aura_export.json");
      res.json(state);
    }),
  );

  app.delete(
    "/api/me/data",
    handle(async (req, res) => {
      await storage.deleteAllUserData(uid(req));
      res.status(204).end();
    }),
  );

  // ---------------------------------------------------------------- Assistant ("Talk to Aura")

  /** The user's local wall-clock time: the client's own value if sent, else from their time zone. */
  async function nowFor(req: Request, sent?: string): Promise<string> {
    if (sent && localDateTimeInput.safeParse(sent).success) return sent.slice(0, 16);
    const header = req.header("x-timezone");
    if (isValidTimeZone(header)) return localDateTime(new Date(), header);
    const { timezone } = await storage.getProfile(uid(req));
    return localDateTime(new Date(), isValidTimeZone(timezone) ? timezone : "UTC");
  }

  async function assistContextFor(req: Request, audience: "patient" | "clinician" = "patient") {
    const { state, date } = await stateFor(req);
    const { memory } = await storage.getProfile(uid(req));
    return buildAssistContext(state, date, audience, memory);
  }

  app.get("/api/assist/status", handle(async (_req, res) => res.json({ ai: assistant.mode === "ai" })));

  // AI calls cost money: past a per-user budget, answer in basic mode for a while instead of failing.
  const AI_BUDGET = { calls: 40, windowMs: 10 * 60_000 };
  const aiCalls = new Map<string, number[]>();
  function providerFor(req: Request): { provider: AssistProvider; notice?: string } {
    if (assistant.mode !== "ai") return { provider: assistant };
    const now = Date.now();
    const recent = (aiCalls.get(uid(req)) ?? []).filter((t) => now - t < AI_BUDGET.windowMs);
    if (recent.length >= AI_BUDGET.calls) return { provider: basic, notice: "You've asked a lot in a short time, so Aura is using basic mode for a few minutes." };
    aiCalls.set(uid(req), [...recent, now]);
    return { provider: assistant };
  }

  // Proposes entries only. Nothing is saved until the patient confirms through the normal routes.
  app.post(
    "/api/assist/capture",
    handle(async (req, res) => {
      const { text, now: sent } = z.object({ text: z.string().trim().min(1).max(4000), now: z.string().optional() }).parse(req.body);
      const now = await nowFor(req, sent);
      const { state } = await stateFor(req);
      const ctx = buildCaptureContext(state, now);
      // The fixed safety screen runs first. If it fires, the text never goes to a model.
      const screen = screenText(text);
      const { provider, notice } = screen.urgent ? { provider: basic } : providerFor(req);
      const proposal = await provider.capture(text, ctx);
      res.json(sanitizeProposal({ ...proposal, ...(notice ? { notice } : {}) }, ctx, screen));
    }),
  );

  app.post(
    "/api/assist/ask",
    handle(async (req, res) => {
      const { question, audience } = z.object({ question: z.string().trim().min(1).max(1000), audience: z.enum(["patient", "clinician"]).default("patient") }).parse(req.body);
      const screen = screenText(question);
      const ctx = await assistContextFor(req, audience);
      const { provider, notice } = screen.urgent ? { provider: basic } : providerFor(req);
      const answer = await provider.ask(question, ctx);
      res.json({ ...answer, ...(notice ? { notice } : {}), screen });
    }),
  );

  app.get(
    "/api/assist/notes",
    handle(async (req, res) => {
      const ctx = await assistContextFor(req);
      res.json(await assistant.phraseNotes(ctx.notes));
    }),
  );

  app.post(
    "/api/assist/notes/dismiss",
    handle(async (req, res) => {
      const { id } = z.object({ id: z.string().min(1).max(200) }).parse(req.body);
      const { memory } = await storage.getProfile(uid(req));
      if (!memory.dismissedNotes.includes(id)) await storage.saveProfile(uid(req), { memory: { ...memory, dismissedNotes: [...memory.dismissedNotes, id].slice(-500) } });
      res.status(204).end();
    }),
  );

  app.get(
    "/api/assist/summary",
    handle(async (req, res) => {
      res.json(await assistant.summary(await assistContextFor(req, "clinician")));
    }),
  );

  // ---------------------------------------------------------------- What Aura remembers

  app.get("/api/memory", handle(async (req, res) => res.json((await storage.getProfile(uid(req))).memory)));

  app.post(
    "/api/memory/life-events",
    handle(async (req, res) => {
      const input = lifeEventInput.parse(req.body);
      const { memory } = await storage.getProfile(uid(req));
      const event = { ...input, id: globalThis.crypto.randomUUID() };
      const lifeEvents = [...memory.lifeEvents, event].sort((a, b) => a.date.localeCompare(b.date)).slice(-200);
      await storage.saveProfile(uid(req), { memory: { ...memory, lifeEvents } });
      res.status(201).json(event);
    }),
  );

  app.delete(
    "/api/memory/life-events/:id",
    handle(async (req, res) => {
      const { id } = idParam.parse(req.params);
      const { memory } = await storage.getProfile(uid(req));
      const lifeEvents = memory.lifeEvents.filter((e) => e.id !== id);
      if (lifeEvents.length === memory.lifeEvents.length) return res.status(404).end();
      await storage.saveProfile(uid(req), { memory: { ...memory, lifeEvents } });
      res.status(204).end();
    }),
  );

  // ---------------------------------------------------------------- Demo data (local development only)

  if (allowDemo) {
    app.post(
      "/api/demo/load",
      handle(async (req, res) => {
        await loadDemo(storage, uid(req), await today(req));
        res.json({ ok: true });
      }),
    );
  }

}

// -------------------------------------------------------------------------------------------
// Insights and the clinician report (pure functions of the engine state)

export function cycleCorrelation(state: AppState, today: string) {
  const phases = ["perimenstrual", "follicular", "ovulation", "luteal"] as const;
  const attacks: Record<string, number> = Object.fromEntries(phases.map((p) => [p, 0]));
  const days: Record<string, number> = Object.fromEntries(phases.map((p) => [p, 0]));
  const phaseOn = (d: string) => {
    const st = cycleStatus({ dailyLogs: state.dailyLogs, periods: state.periods }, d);
    if (!st || st.cycleDay > st.averageLength + 10) return null;
    return inPerimenstrualWindow(d, st.lastStart) || inPerimenstrualWindow(d, st.nextStart) ? "perimenstrual" : st.phase === "menstruation" ? "perimenstrual" : st.phase;
  };
  const first = state.periods.map((p) => p.start).sort()[0];
  if (!first) return [];
  for (const d of dateRange(first, today)) {
    const p = phaseOn(d);
    if (p) days[p]++;
  }
  for (const a of state.attacks) {
    const p = phaseOn(a.start.slice(0, 10));
    if (p) attacks[p]++;
  }
  const totalAttacks = Object.values(attacks).reduce((s, n) => s + n, 0);
  const totalDays = Object.values(days).reduce((s, n) => s + n, 0);
  return phases.map((phase) => {
    const attackShare = totalAttacks ? attacks[phase] / totalAttacks : 0;
    const dayShare = totalDays ? days[phase] / totalDays : 0;
    return { phase, attacks: attacks[phase], days: days[phase], attackShare, dayShare, ratio: dayShare ? attackShare / dayShare : null };
  });
}

export function buildInsights(state: AppState, today: string) {
  const model = fitRiskModel(state);
  const weights = [...model.weights.values()]
    .filter((w) => w.exposedDays > 0 || state.patterns.triggers.some((t) => t.id === w.id))
    .sort((a, b) => b.rr - a.rr);
  return {
    summary30: summarize(state, windowEnding(today, 30)),
    summary90: summarize(state, windowEnding(today, 90)),
    triggers: weights,
    metrics: compareMetrics(state),
    medicationResponses: medicationResponses(state).map((r) => ({ ...r, medication: { id: r.medication.id, name: r.medication.name, cls: r.medication.cls } })),
    alleviators: frequency(state, "alleviators"),
    exacerbators: frequency(state, "exacerbators"),
    reportedTriggers: frequency(state, "triggers"),
    menstrual: menstrualPattern(state),
    cycleCorrelation: cycleCorrelation(state, today),
    backtest: backtest(state, today),
    loggedDays: model.loggedDays,
    scores: (["sleepScore", "readinessScore"] as const).map((metric) => ({
      metric,
      source: primarySource(state, metric) ?? null,
      bands: scoreBands(state, metric),
      suggestion: suggestThreshold(state, metric),
      currentThreshold: metric === "sleepScore" ? thresholdsFor(state).lowSleepScore : thresholdsFor(state).lowReadiness,
      personal: metric === "sleepScore" ? state.patterns.thresholds?.sleepScoreBelow !== undefined : state.patterns.thresholds?.readinessBelow !== undefined,
    })),
  };
}

export function buildReport(state: AppState, today: string) {
  const recs = evaluate(state, today);
  const auraAttacks = state.attacks.filter(hasAura);
  const midas = latestMidas(state);
  const profile = state.profile;
  const vascular = [
    auraAttacks.length > 0 && `Migraine with aura (${auraAttacks.length} logged attacks)`,
    profile.smoking === "current" && "Current smoker",
    state.medications.some((m) => m.active && m.cls === "hormonal-contraceptive-combined") && "Estrogen-containing contraception",
    ...profile.conditions.filter((c) => ["hypertension", "uncontrolled-hypertension", "coronary-disease", "stroke-tia", "peripheral-vascular", "obesity"].includes(c)).map((c) => labelOf(CONDITIONS, c)),
    profile.pregnant && "Pregnant",
    ...profile.familyHistory.filter((f) => ["early-stroke", "early-heart-attack", "clotting-disorder"].includes(f.condition)).map((f) => `Family history: ${labelOf(FAMILY_HISTORY, f.condition)}`),
  ].filter(Boolean);
  const acuteDays = acuteMedicationDays(state.attacks, state.medications, windowEnding(today, 30));
  return {
    generatedFor: today,
    profile,
    patterns: state.patterns,
    summary30: summarize(state, windowEnding(today, 30)),
    summary90: summarize(state, windowEnding(today, 90)),
    medications: [...state.medications].sort((a, b) => Number(b.active) - Number(a.active) || a.role.localeCompare(b.role)),
    supplements: state.supplements,
    overuse: overuseStatus(state, today),
    acuteMedicationDaysByClass: Object.fromEntries([...acuteDays].map(([k, v]) => [k, v.size])),
    medicationResponses: medicationResponses(state).map((r) => ({ ...r, medication: { id: r.medication.id, name: r.medication.name, cls: r.medication.cls } })),
    recommendations: recs,
    vascularFactors: vascular,
    aura: {
      attacksWithAura: auraAttacks.length,
      averageMinutes: auraAttacks.filter((a) => a.auraMinutes).length
        ? Math.round(auraAttacks.reduce((s, a) => s + (a.auraMinutes ?? 0), 0) / auraAttacks.filter((a) => a.auraMinutes).length)
        : null,
      unusual: auraAttacks.filter((a) => a.auraOnset === "sudden" || a.auraUsual === false || (a.auraMinutes ?? 0) > 60).map((a) => ({ start: a.start, minutes: a.auraMinutes, onset: a.auraOnset, usual: a.auraUsual })),
    },
    midas: midas ? { date: midas.date, score: midasScore(midas), ...midasGrade(midasScore(midas)) } : null,
    attacks: state.attacks.filter((a) => a.start.slice(0, 10) >= addDays(today, -89)),
    topTriggers: [...fitRiskModel(state).weights.values()].filter((w) => w.exposedDays >= 3).sort((a, b) => b.rr - a.rr).slice(0, 8),
    menstrual: menstrualPattern(state),
  };
}

async function loadDemo(storage: IStorage, userId: string, today: string) {
  const demo = demoState(today);
  await storage.deleteAllUserData(userId);
  await storage.saveProfile(userId, { profile: demo.profile as never, patterns: demo.patterns as never });
  const medIds = new Map<string, string>();
  for (const m of demo.medications) {
    const { id, ...rest } = m;
    medIds.set(id, (await storage.createMedication(userId, { overTheCounter: false, ...rest })).id);
  }
  for (const s of demo.supplements) {
    const { id: _id, ...rest } = s;
    await storage.createSupplement(userId, rest);
  }
  const floating = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  for (const a of demo.attacks) {
    const { id: _id, start, end, doses, ...rest } = a;
    await storage.createAttack(userId, attackInput.parse({
      ...rest,
      start: floating(start),
      end: end ? floating(end) : undefined,
      doses: doses.map((d) => ({ ...d, medicationId: medIds.get(d.medicationId)!, takenAt: floating(d.takenAt) })),
    }));
  }
  const periods: { startDate: string; endDate: string }[] = [];
  for (const log of demo.dailyLogs) {
    const { date, exposures, ...rest } = log;
    await storage.upsertDailyLog(userId, date, dailyLogInput.parse({ ...rest, exposures: exposures.filter((e) => e !== "menstruation") }));
    if (exposures.includes("menstruation") && !demo.dailyLogs.find((l) => l.date === addDays(date, -1))?.exposures.includes("menstruation")) {
      periods.push({ startDate: date, endDate: addDays(date, 4) });
    }
  }
  await storage.addPeriods(userId, periods);
  await storage.upsertWearableSamples(userId, demo.wearableSamples);
  for (const m of demo.midas) await storage.addMidas(userId, m.date, m.answers);
}
