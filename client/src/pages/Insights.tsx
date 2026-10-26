import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiJson, invalidateAll } from "@/lib/queryClient";
import { deviceById } from "@shared/engine/domain/deviceScoring";
import type { ProfileRecord } from "@/lib/types";
import { useCycleTracking } from "@/lib/cycle";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import CycleAnalyticsChart, { type CyclePhaseRow } from "@/components/CycleAnalyticsChart";
import TrendsChart from "@/components/TrendsChart";
import { ALLEVIATORS, EXACERBATORS, labelOf } from "@shared/engine/domain/catalog";
import type { SummaryStats } from "@shared/engine/cds/metrics";
import type { MetricComparison, FrequencyItem, MenstrualPattern } from "@shared/engine/cds/patterns";
import type { TriggerWeight, Backtest } from "@shared/engine/cds/riskModel";

interface InsightsData {
  summary30: SummaryStats;
  summary90: SummaryStats;
  triggers: TriggerWeight[];
  metrics: MetricComparison[];
  medicationResponses: { medication: { id: string; name: string }; rated: number; painFree: number; partial: number; none: number; recurrence: number; medianDelayMin: number | null }[];
  alleviators: FrequencyItem[];
  exacerbators: FrequencyItem[];
  menstrual: MenstrualPattern | null;
  cycleCorrelation: CyclePhaseRow[];
  backtest: Backtest | null;
  loggedDays: number;
  scores: {
    metric: "sleepScore" | "readinessScore";
    source: string | null;
    bands: { label: string; days: number; daysFollowedByAttack: number; attackRate: number }[];
    suggestion: { below: number; relativeRisk: number; exposedDays: number } | null;
    currentThreshold: number;
    personal: boolean;
  }[];
}

const SCORE_NAME = { sleepScore: "Sleep score", readinessScore: "Readiness / recovery score" } as const;

const x = (n?: number) => (n === undefined ? "—" : `×${n.toFixed(1)}`);

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </Card>
  );
}

export default function Insights({ date }: { date: string }) {
  const { data } = useQuery<InsightsData>({ queryKey: [`/api/insights?date=${date}`] });
  const { data: trends = [] } = useQuery<{ date: string; readiness: number | null; sleep: number | null; stress: number | null; migraine: number }[]>({
    queryKey: [`/api/trends?date=${date}&days=30`],
  });
  const { data: profile } = useQuery<ProfileRecord>({ queryKey: ["/api/profile"] });
  const tracksCycle = useCycleTracking();
  const applyThreshold = useMutation({
    mutationFn: ({ metric, below }: { metric: "sleepScore" | "readinessScore"; below: number }) =>
      apiJson("/api/profile", "PUT", {
        patterns: { ...profile!.patterns, thresholds: { ...profile!.patterns.thresholds, [metric === "sleepScore" ? "sleepScoreBelow" : "readinessBelow"]: below } },
      }),
    onSuccess: () => invalidateAll(),
  });
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  const s = data.summary30;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">What your data shows</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Migraine days" value={s.migraineDays} sub={`last 30 days · ${data.summary90.migraineDays} in 90`} />
        <Stat label="Headache days" value={s.headacheDays} sub="last 30 days, any headache" />
        <Stat label="Days on acute medicine" value={s.acuteMedicationDays} sub="last 30 days" />
        <Stat label="Average worst pain" value={s.meanSeverity === null ? "—" : `${s.meanSeverity.toFixed(1)}/10`} sub={`${s.attacks} attacks, last 30 days`} />
      </div>

      <Card className="p-6" data-testid="card-trigger-weights">
        <h2 className="text-lg font-semibold">Your triggers</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Each estimate starts from research and your own answers, then shifts toward what your logs show. The bar is how much of it now comes from your
          own data ({data.loggedDays} check-in days so far).
        </p>
        {data.triggers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Complete "My patterns" and keep checking in to see your triggers here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Trigger</th>
                  <th className="py-2 pr-3">Now</th>
                  <th className="py-2 pr-3">Research</th>
                  <th className="py-2 pr-3">Your answer</th>
                  <th className="py-2 pr-3">Your data</th>
                  <th className="py-2 w-40">From your data</th>
                </tr>
              </thead>
              <tbody>
                {data.triggers.slice(0, 20).map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-2 pr-3">{t.label}</td>
                    <td className={`py-2 pr-3 font-semibold ${t.rr >= 1.5 ? "text-orange-600" : ""}`}>{x(t.rr)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{x(t.researchRR)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{x(t.selfReportedRR)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {x(t.dataRR)} <span className="text-xs">({t.exposedDays} days)</span>
                    </td>
                    <td className="py-2">
                      <Progress value={Math.round(t.personalWeight * 100)} aria-label={`${Math.round(t.personalWeight * 100)}% from your data`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground mt-3">×1.0 means no effect; ×2.0 means attacks are about twice as likely that day or the next.</p>
          </div>
        )}
      </Card>

      {data.scores
        .filter((sc) => sc.bands.some((b) => b.days > 0))
        .map((sc) => (
          <Card key={sc.metric} className="p-6" data-testid={`card-bands-${sc.metric}`}>
            <h2 className="text-lg font-semibold">
              {SCORE_NAME[sc.metric]} and your attacks{sc.source && deviceById(sc.source) ? ` (${deviceById(sc.source)!.name})` : ""}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">How often an attack started the same day or the next, by score.</p>
            <div className="space-y-2">
              {sc.bands
                .filter((b) => b.days > 0)
                .map((b) => (
                  <div key={b.label} className="grid grid-cols-[6rem_1fr_9rem] items-center gap-3 text-sm">
                    <span>{b.label}</span>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(b.attackRate * 100)}%` }} />
                    </div>
                    <span className="text-muted-foreground">
                      {Math.round(b.attackRate * 100)}% of {b.days} days
                    </span>
                  </div>
                ))}
            </div>
            <div className="mt-4 text-sm flex flex-wrap items-center justify-between gap-3">
              <span>
                Counting a {SCORE_NAME[sc.metric].toLowerCase()} below <strong>{sc.currentThreshold}</strong> as low
                {sc.personal ? " (your setting)" : " (device default)"}.
                {sc.suggestion &&
                  sc.suggestion.below !== sc.currentThreshold &&
                  ` Your data points to below ${sc.suggestion.below}: attacks ${sc.suggestion.relativeRisk.toFixed(1)}× as likely after those days.`}
              </span>
              {sc.suggestion && sc.suggestion.below !== sc.currentThreshold && profile && (
                <Button size="sm" onClick={() => applyThreshold.mutate({ metric: sc.metric, below: sc.suggestion!.below })} disabled={applyThreshold.isPending}>
                  Use below {sc.suggestion.below}
                </Button>
              )}
            </div>
          </Card>
        ))}

      {trends.length > 0 && <TrendsChart data={trends} days={30} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">How your medicines work</h2>
          {data.medicationResponses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Log doses during attacks, and rate how you felt 2 hours later.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1">Medicine</th>
                  <th>Pain-free at 2 h</th>
                  <th>Better</th>
                  <th>Usually taken</th>
                </tr>
              </thead>
              <tbody>
                {data.medicationResponses.map((r) => (
                  <tr key={r.medication.id} className="border-t border-border">
                    <td className="py-2">{r.medication.name}</td>
                    <td>{r.rated ? `${r.painFree}/${r.rated}` : "not rated"}</td>
                    <td>{r.rated ? `${r.partial}/${r.rated}` : ""}</td>
                    <td>{r.medianDelayMin === null ? "—" : `${Math.round(r.medianDelayMin)} min after onset`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">What changes before your attacks</h2>
          {data.metrics.filter((m) => Math.abs(m.effectSize) >= 0.3).length === 0 ? (
            <p className="text-sm text-muted-foreground">No clear differences yet between the days before attacks and other days.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.metrics
                .filter((m) => Math.abs(m.effectSize) >= 0.3)
                .slice(0, 6)
                .map((m) => (
                  <li key={m.metric} className="flex justify-between">
                    <span>{m.label}</span>
                    <span className="text-muted-foreground">
                      {m.preAttackMean.toFixed(1)}
                      {m.unit} before attacks vs {m.otherMean.toFixed(1)}
                      {m.unit} otherwise
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      {tracksCycle && data.cycleCorrelation.length > 0 && <CycleAnalyticsChart data={data.cycleCorrelation} />}
      {tracksCycle && data.menstrual?.meetsCriteria && (
        <Card className="p-5 bg-pink-500/5 text-sm">
          Attacks started from 2 days before to 3 days after your period began in {data.menstrual.cyclesWithAttack} of {data.menstrual.cycles} cycles — the
          pattern of {data.menstrual.pure ? "pure menstrual" : "menstrually related"} migraine. Worth discussing short-term prevention around your period with
          your doctor.
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">What helps you most often</h2>
          {data.alleviators.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.alleviators.slice(0, 6).map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span>{labelOf(ALLEVIATORS, a.id)}</span>
                  <span className="text-muted-foreground">{Math.round(a.share * 100)}% of attacks</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">What makes it worse</h2>
          {data.exacerbators.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.exacerbators.slice(0, 6).map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span>{labelOf(EXACERBATORS, a.id)}</span>
                  <span className="text-muted-foreground">{Math.round(a.share * 100)}% of attacks</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-6" data-testid="card-forecast-accuracy">
        <h2 className="text-lg font-semibold mb-2">How accurate your forecast has been</h2>
        {data.backtest ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              Each of the last {data.backtest.days} days was re-forecast using only what was known before it, then compared with what happened.
              {data.backtest.brier < data.backtest.brierBaseline
                ? " The forecast has done better than simply assuming an average day."
                : " So far it hasn't beaten simply assuming an average day — more check-ins will help."}
            </p>
            <table className="text-sm">
              <tbody>
                {data.backtest.byLevel.map((l) => (
                  <tr key={l.level}>
                    <td className="pr-6 py-1 capitalize">{l.level.replace("-", " ")} days</td>
                    <td className="pr-6 text-muted-foreground">{l.days} days</td>
                    <td>attack followed {Math.round(l.attackRate * 100)}% of the time</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Needs a few weeks of check-ins first.</p>
        )}
      </Card>
    </div>
  );
}
