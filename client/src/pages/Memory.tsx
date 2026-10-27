import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import NoticedCard from "@/components/assist/NoticedCard";
import { useToast } from "@/hooks/use-toast";
import { formatShortDate, todayLocal } from "@/lib/dates";
import { apiJson, invalidateAll } from "@/lib/queryClient";
import { useCycleTracking } from "@/lib/cycle";
import type { CycleStatus, Medication, ProfileRecord } from "@/lib/types";
import { CONDITIONS, TRIGGERS, WARNING_SIGNS, labelOf } from "@shared/engine/domain/catalog";
import { LIFE_EVENT_KINDS, type AssistMemory, type LifeEventInput } from "@shared/assist/types";
import type { TriggerWeight } from "@shared/engine/cds/riskModel";
import type { View } from "../App";

const LIKELIHOOD: Record<string, string> = { unsure: "not sure", sometimes: "sometimes", often: "often", "almost-always": "almost always" };
const KIND_LABEL: Record<(typeof LIFE_EVENT_KINDS)[number], string> = {
  work: "Work",
  travel: "Travel",
  illness: "Illness",
  family: "Family / home",
  sleep: "Sleep",
  diet: "Food / diet",
  exercise: "Exercise",
  other: "Other",
};

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Everything the assistant keeps about the patient, in one place they can check and change. */
export default function Memory({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { toast } = useToast();
  const { data: profile } = useQuery<ProfileRecord>({ queryKey: ["/api/profile"] });
  const { data: memory } = useQuery<AssistMemory>({ queryKey: ["/api/memory"] });
  const { data: medications = [] } = useQuery<Medication[]>({ queryKey: ["/api/medications"] });
  const { data: insights } = useQuery<{ triggers: TriggerWeight[]; loggedDays: number; scores: { metric: string; suggestion: { below: number; relativeRisk: number } | null }[] }>({
    queryKey: [`/api/insights?date=${todayLocal()}`],
  });
  const { data: status } = useQuery<{ ai: boolean }>({ queryKey: ["/api/assist/status"] });
  const tracksCycle = useCycleTracking();
  const { data: cycle } = useQuery<CycleStatus | null>({ queryKey: [`/api/cycle/current?date=${todayLocal()}`], enabled: tracksCycle });
  const [draft, setDraft] = useState<LifeEventInput>({ date: todayLocal(), label: "", kind: "other" });

  const onError = (e: Error) => toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
  const addEvent = useMutation({
    mutationFn: (e: LifeEventInput) => apiJson("/api/memory/life-events", "POST", e),
    onSuccess: () => {
      setDraft({ date: todayLocal(), label: "", kind: "other" });
      invalidateAll();
    },
    onError,
  });
  const removeEvent = useMutation({ mutationFn: (id: string) => apiJson(`/api/memory/life-events/${id}`, "DELETE"), onSuccess: () => invalidateAll(), onError });

  if (!profile || !memory) return <p className="text-muted-foreground">Loading…</p>;
  const p = profile.profile;
  const pat = profile.patterns;
  const age = p.birthYear ? new Date().getFullYear() - p.birthYear : null;
  const active = medications.filter((m) => m.active);
  const learned = (insights?.triggers ?? []).filter((t) => t.exposedDays >= 3 && t.rr >= 1.2).slice(0, 5);
  const sleepTip = insights?.scores.find((s) => s.metric === "sleepScore")?.suggestion;
  const customLabel = (id: string) => pat.customTriggers.find((c) => c.id === id)?.label ?? labelOf(TRIGGERS, id);
  const edit = (view: View, label = "Edit") => (
    <Button variant="ghost" size="sm" className="px-2 text-primary underline-offset-2 hover:underline" onClick={() => onNavigate(view)}>
      {label}
    </Button>
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">What Aura remembers</h1>
        <p className="text-muted-foreground mt-1">
          Everything Aura uses about you is on this page, and you can change any of it. Aura has no hidden memory: {status?.ai ? "in AI mode, each question sends only what that answer needs, and nothing is kept by the AI." : "it runs in basic mode, so nothing leaves Aura's own server."}
        </p>
      </div>

      <NoticedCard />

      <Section title="Life events" action={null}>
        <p className="text-sm text-muted-foreground">Changes in your life that might affect your migraines. Aura shows them alongside your patterns and in your doctor's summary.</p>
        {memory.lifeEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet. Add one below, or mention it to Aura (“started a new job”).</p>
        ) : (
          <ul className="divide-y divide-border">
            {[...memory.lifeEvents].reverse().map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="font-medium">{e.label}</span> · {KIND_LABEL[e.kind]} · from {formatShortDate(e.date)}
                  {e.endDate ? ` to ${formatShortDate(e.endDate)}` : ""}
                </span>
                <Button variant="ghost" size="icon" aria-label={`Remove ${e.label}`} onClick={() => removeEvent.mutate(e.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
          <div>
            <Label htmlFor="le-label">What happened</Label>
            <Input id="le-label" maxLength={120} placeholder="e.g. Started night shifts" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="le-date">From</Label>
            <Input id="le-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </div>
          <div>
            <Label>Kind</Label>
            <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as LifeEventInput["kind"] })}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIFE_EVENT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => addEvent.mutate(draft)} disabled={!draft.label.trim() || addEvent.isPending} data-testid="button-add-life-event">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </Section>

      <Section title="What Aura has learned from your logs">
        {learned.length ? (
          <ul className="text-sm list-disc pl-5 space-y-1">
            {learned.map((t) => (
              <li key={t.id}>
                {t.label}: {t.rr.toFixed(1)}× the usual risk ({t.exposedDays} days of your data)
              </li>
            ))}
            {sleepTip && <li>Sleep score below {sleepTip.below}: {sleepTip.relativeRisk.toFixed(1)}× the risk</li>}
            {tracksCycle && cycle && <li>Your cycle: about {cycle.averageLength} days{cycle.lengthIsEstimated ? " (estimated until more periods are logged)" : ""}</li>}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Not enough logged days yet. Patterns show up after a few weeks of check-ins.</p>
        )}
        <p className="text-xs text-muted-foreground">From {insights?.loggedDays ?? 0} logged days. Full detail on My patterns.</p>
        {edit("insights", "See My patterns")}
      </Section>

      <Section title="What you told Aura" action={edit("patterns")}>
        {pat.triggers.length || pat.customTriggers.length ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Your triggers: </span>
            {pat.triggers.map((t) => `${customLabel(t.id)} (${LIKELIHOOD[t.likelihood] ?? t.likelihood})`).join(", ")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">You haven't filled in your migraine patterns yet.</p>
        )}
        {pat.warningSigns.length > 0 && (
          <p className="text-sm">
            <span className="text-muted-foreground">Early warning signs: </span>
            {pat.warningSigns.map((w) => labelOf(WARNING_SIGNS, w)).join(", ")}
          </p>
        )}
        {pat.thresholds && Object.values(pat.thresholds).some((v) => v !== undefined) && (
          <p className="text-sm">
            <span className="text-muted-foreground">Your own cut-offs: </span>
            {[
              pat.thresholds.sleepScoreBelow !== undefined && `sleep score below ${pat.thresholds.sleepScoreBelow}`,
              pat.thresholds.readinessBelow !== undefined && `readiness below ${pat.thresholds.readinessBelow}`,
              pat.thresholds.stressAtLeast !== undefined && `stress ${pat.thresholds.stressAtLeast}/10 or more`,
              pat.thresholds.lateLunchAfter && `lunch after ${pat.thresholds.lateLunchAfter}`,
              pat.thresholds.shortSleepHours !== undefined && `under ${pat.thresholds.shortSleepHours} h sleep`,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
      </Section>

      <Section title="About you" action={edit("profile")}>
        <p className="text-sm">
          {[p.name, p.sex !== "unspecified" && p.sex, age !== null && `${age} years old`, p.pregnant && "pregnant or recently gave birth"].filter(Boolean).join(" · ") || "No details yet."}
        </p>
        {p.conditions.length > 0 && <p className="text-sm text-muted-foreground">Health conditions: {p.conditions.map((c) => labelOf(CONDITIONS, c)).join(", ")}</p>}
        {p.familyHistory.length > 0 && <p className="text-sm text-muted-foreground">Family history: {p.familyHistory.length} condition{p.familyHistory.length === 1 ? "" : "s"} recorded</p>}
      </Section>

      <Section title="Your medicines" action={edit("medications")}>
        {active.length ? (
          <ul className="text-sm list-disc pl-5">
            {active.map((m) => (
              <li key={m.id}>
                {m.name}
                {m.dose ? ` ${m.dose}` : ""} <span className="text-muted-foreground">({m.role})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No medicines recorded.</p>
        )}
      </Section>

      <p className="text-xs text-muted-foreground">To take a copy of everything or delete it, go to Health profile → Your data.</p>
    </div>
  );
}
