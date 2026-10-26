import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ChipPicker from "@/components/ChipPicker";
import { useToast } from "@/hooks/use-toast";
import { apiJson, invalidateAll } from "@/lib/queryClient";
import type { ProfileRecord } from "@/lib/types";
import { ALLEVIATORS, EXACERBATORS, TRIGGERS, WARNING_SIGNS } from "@shared/engine/domain/catalog";
import { TRIGGER_PRIORS } from "@shared/engine/cds/priors";
import type { PatternsInput } from "@shared/api";

type Likelihood = PatternsInput["triggers"][number]["likelihood"];
const LIKELIHOOD: { value: Likelihood | "no"; label: string }[] = [
  { value: "no", label: "Not for me" },
  { value: "unsure", label: "Not sure" },
  { value: "sometimes", label: "Sometimes" },
  { value: "often", label: "Often" },
  { value: "almost-always", label: "Almost always" },
];

/** Triggers derived from numbers in the check-in; asking about them separately would double count. */
const DERIVED = new Set(["low-sleep-score", "low-readiness"]);

const evidenceLabel = (id: string) => {
  const p = TRIGGER_PRIORS[id];
  if (!p) return null;
  if (p.evidence === "prospective" && p.rr >= 1.3) return "Research: a confirmed trigger for many people";
  if (p.evidence === "prospective") return "Research: small effect on average; varies by person";
  if (p.evidence === "survey") return "Research: commonly reported, less often confirmed";
  return "Research: little data — your own logs will tell";
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export default function Patterns() {
  const { toast } = useToast();
  const { data } = useQuery<ProfileRecord>({ queryKey: ["/api/profile"] });
  const [p, setP] = useState<PatternsInput | null>(null);
  const [newTrigger, setNewTrigger] = useState("");
  useEffect(() => {
    if (data && !p) setP(data.patterns);
  }, [data, p]);

  const save = useMutation({
    mutationFn: (patterns: PatternsInput) => apiJson("/api/profile", "PUT", { patterns: { ...patterns, completedAt: patterns.completedAt ?? new Date().toISOString() } }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Saved", description: "Your forecast now starts from your own experience and adjusts as you log." });
    },
    onError: (e: Error) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  if (!p) return <p className="text-muted-foreground">Loading…</p>;
  const set = <K extends keyof PatternsInput>(k: K, v: PatternsInput[K]) => setP({ ...p, [k]: v });
  const belief = (id: string) => p.triggers.find((t) => t.id === id);
  const setBelief = (id: string, likelihood: Likelihood | "no", strategy?: string) => {
    const others = p.triggers.filter((t) => t.id !== id);
    set("triggers", likelihood === "no" ? others : [...others, { id, likelihood, strategy: strategy ?? belief(id)?.strategy }]);
  };
  const addCustom = () => {
    const label = newTrigger.trim();
    if (!label) return;
    const id = `custom:${slug(label)}`;
    if (!p.customTriggers.some((c) => c.id === id)) {
      setP({ ...p, customTriggers: [...p.customTriggers, { id, label }], triggers: [...p.triggers, { id, likelihood: "often" }] });
    }
    setNewTrigger("");
  };

  const triggerRow = (id: string, label: string, removable = false) => {
    const b = belief(id);
    return (
      <div key={id} className="py-3 border-b border-border last:border-0" data-testid={`trigger-row-${id}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium text-sm">{label}</div>
            {evidenceLabel(id) && <div className="text-xs text-muted-foreground">{evidenceLabel(id)}</div>}
          </div>
          <div className="flex items-center gap-2">
            <Select value={b?.likelihood ?? "no"} onValueChange={(v) => setBelief(id, v as Likelihood | "no")}>
              <SelectTrigger className="w-40" aria-label={`How often ${label} triggers an attack`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIKELIHOOD.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {removable && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${label}`}
                onClick={() => setP({ ...p, customTriggers: p.customTriggers.filter((c) => c.id !== id), triggers: p.triggers.filter((t) => t.id !== id) })}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        {b && b.likelihood !== "unsure" && (
          <Input
            className="mt-2"
            placeholder="What do you do to avoid or manage it? (optional)"
            value={b.strategy ?? ""}
            onChange={(e) => setBelief(id, b.likelihood, e.target.value || undefined)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">What you've noticed</h1>
        <p className="text-muted-foreground mt-1">
          You know your migraines best. Your answers set the starting point for your forecast; as you log, the app checks them against what actually happens
          and adjusts.
        </p>
      </div>

      <Card className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="pt-days">Migraine days in a usual month</Label>
          <Input id="pt-days" type="number" min={0} max={31} value={p.typicalMigraineDaysPerMonth ?? ""} onChange={(e) => set("typicalMigraineDaysPerMonth", e.target.value === "" ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="pt-dur">Usual length of an attack (hours)</Label>
          <Input id="pt-dur" type="number" min={0} max={240} value={p.typicalDurationHours ?? ""} onChange={(e) => set("typicalDurationHours", e.target.value === "" ? undefined : Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="pt-years">Years with migraine</Label>
          <Input id="pt-years" type="number" min={0} max={100} value={p.yearsWithMigraine ?? ""} onChange={(e) => set("yearsWithMigraine", e.target.value === "" ? undefined : Number(e.target.value))} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">What sets your migraines off?</h2>
        <p className="text-sm text-muted-foreground mb-2">For each one, how often does it lead to an attack within a day or so?</p>
        {TRIGGERS.filter((t) => !DERIVED.has(t.id)).map((t) => triggerRow(t.id, t.label))}
        {p.customTriggers.map((c) => triggerRow(c.id, c.label, true))}
        <div className="flex gap-2 mt-4">
          <Input placeholder="Something else? e.g. night shifts, long drives" value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} />
          <Button variant="outline" onClick={addCustom} data-testid="button-add-custom-trigger">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4" data-testid="card-thresholds">
        <div>
          <h2 className="text-lg font-semibold">Your own cut-offs</h2>
          <p className="text-sm text-muted-foreground">
            If you've noticed your attacks follow, say, a sleep score under 50, set it here. Leave blank to use your device's own bands (or 70).
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(
            [
              ["sleepScoreBelow", "Low sleep score: below", 1, 100],
              ["readinessBelow", "Low readiness / recovery: below", 1, 100],
              ["stressAtLeast", "Stressful day: my stress rating at least (0–10)", 1, 10],
              ["shortSleepHours", "Short sleep: under (hours)", 1, 12],
            ] as const
          ).map(([key, label, min, max]) => (
            <div key={key}>
              <Label htmlFor={`th-${key}`}>{label}</Label>
              <Input
                id={`th-${key}`}
                type="number"
                min={min}
                max={max}
                value={p.thresholds?.[key] ?? ""}
                onChange={(e) => set("thresholds", { ...p.thresholds, [key]: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </div>
          ))}
          <div>
            <Label htmlFor="th-lunch">Late lunch: at or after</Label>
            <Input id="th-lunch" type="time" value={p.thresholds?.lateLunchAfter ?? ""} onChange={(e) => set("thresholds", { ...p.thresholds, lateLunchAfter: e.target.value || undefined })} />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold mb-2">Early warning signs you notice</h2>
          <ChipPicker options={WARNING_SIGNS} value={p.warningSigns} onChange={(v) => set("warningSigns", v)} />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">What usually helps</h2>
          <ChipPicker options={ALLEVIATORS} value={p.alleviators} onChange={(v) => set("alleviators", v)} />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">What makes it worse</h2>
          <ChipPicker options={EXACERBATORS} value={p.exacerbators} onChange={(v) => set("exacerbators", v)} />
        </div>
        <div>
          <Label htmlFor="pt-notes">Anything else you've learned about your migraines</Label>
          <Textarea id="pt-notes" rows={3} value={p.notes ?? ""} onChange={(e) => set("notes", e.target.value || undefined)} />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => save.mutate(p)} disabled={save.isPending} data-testid="button-save-patterns">
          Save my patterns
        </Button>
      </div>
    </div>
  );
}
