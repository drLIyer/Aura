import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { todayLocal, userTimeZone } from "@/lib/dates";
import { apiJson, invalidateAll } from "@/lib/queryClient";
import type { ProfileRecord } from "@/lib/types";
import { CONDITIONS, FAMILY_HISTORY } from "@shared/engine/domain/catalog";
import { midasGrade } from "@shared/engine/cds/metrics";
import type { ProfileInput } from "@shared/api";

type Relative = ProfileInput["familyHistory"][number]["relatives"][number];
const RELATIVES: { id: Relative; label: string }[] = [
  { id: "mother", label: "Mother" },
  { id: "father", label: "Father" },
  { id: "sibling", label: "Brother/sister" },
  { id: "child", label: "Child" },
  { id: "grandparent", label: "Grandparent" },
];

const MIDAS_QUESTIONS = [
  "On how many days in the last 3 months did you miss work or school because of headaches?",
  "How many days in the last 3 months was your productivity at work or school reduced by half or more because of headaches? (Don't count days you missed.)",
  "On how many days in the last 3 months did you not do household work because of headaches?",
  "How many days in the last 3 months was your productivity in household work reduced by half or more because of headaches? (Don't count days you didn't do it.)",
  "On how many days in the last 3 months did you miss family, social or leisure activities because of headaches?",
];

export default function Profile() {
  const { toast } = useToast();
  const { data } = useQuery<ProfileRecord>({ queryKey: ["/api/profile"] });
  const { data: midasList = [] } = useQuery<{ id: string; date: string; answers: number[] }[]>({ queryKey: ["/api/midas"] });
  const [p, setP] = useState<ProfileInput | null>(null);
  const [midas, setMidas] = useState<number[]>([0, 0, 0, 0, 0]);
  useEffect(() => {
    if (data && !p) setP(data.profile);
  }, [data, p]);

  const onError = (e: Error) => toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
  const save = useMutation({
    mutationFn: (profile: ProfileInput) => apiJson("/api/profile", "PUT", { profile, timezone: userTimeZone() }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Profile saved" });
    },
    onError,
  });
  const saveMidas = useMutation({
    mutationFn: () => apiJson("/api/midas", "POST", { date: todayLocal(), answers: midas }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "MIDAS saved" });
    },
    onError,
  });
  const deleteAll = useMutation({
    mutationFn: () => apiJson("/api/me/data", "DELETE"),
    onSuccess: () => {
      setP(null);
      invalidateAll();
      toast({ title: "All your data was deleted" });
    },
    onError,
  });
  const loadDemo = useMutation({
    mutationFn: () => apiJson(`/api/demo/load?date=${todayLocal()}`, "POST"),
    onSuccess: () => {
      setP(null);
      invalidateAll();
      toast({ title: "Demo data loaded" });
    },
    onError,
  });

  if (!p) return <p className="text-muted-foreground">Loading…</p>;
  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) => setP({ ...p, [k]: v });
  const fh = (condition: string) => p.familyHistory.find((f) => f.condition === condition);
  const toggleRelative = (condition: string, rel: Relative, on: boolean) => {
    const current = fh(condition)?.relatives ?? [];
    const relatives = on ? [...current, rel] : current.filter((r) => r !== rel);
    const others = p.familyHistory.filter((f) => f.condition !== condition);
    set("familyHistory", relatives.length ? [...others, { condition, relatives }] : others);
  };
  const latest = [...midasList].sort((a, b) => b.date.localeCompare(a.date))[0];
  const midasTotal = midas.reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold">Health profile</h1>

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="pf-by">Year of birth</Label>
            <Input id="pf-by" type="number" min={1900} max={2100} value={p.birthYear ?? ""} onChange={(e) => set("birthYear", e.target.value === "" ? undefined : Number(e.target.value))} />
          </div>
          <div>
            <Label>Sex</Label>
            <Select value={p.sex} onValueChange={(v) => set("sex", v as ProfileInput["sex"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="intersex">Intersex</SelectItem>
                <SelectItem value="unspecified">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pf-onset">Year migraines began</Label>
            <Input id="pf-onset" type="number" min={1900} max={2100} value={p.migraineOnsetYear ?? ""} onChange={(e) => set("migraineOnsetYear", e.target.value === "" ? undefined : Number(e.target.value))} />
          </div>
          <div>
            <Label>Smoking or vaping</Label>
            <Select value={p.smoking ?? "unset"} onValueChange={(v) => set("smoking", v === "unset" ? undefined : (v as ProfileInput["smoking"]))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">—</SelectItem>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="former">Used to</SelectItem>
                <SelectItem value="current">Currently</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={Boolean(p.childbearingPotential)} onCheckedChange={(v) => set("childbearingPotential", v === true)} /> Could become pregnant
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={Boolean(p.pregnant)} onCheckedChange={(v) => set("pregnant", v === true)} /> Pregnant or gave birth in the last 6 weeks
          </label>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">Health conditions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CONDITIONS.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={p.conditions.includes(c.id)} onCheckedChange={(v) => set("conditions", v === true ? [...p.conditions, c.id] : p.conditions.filter((x) => x !== c.id))} />
              {c.label}
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Family history</h2>
        <p className="text-sm text-muted-foreground mb-3">Tick who in your close family has had each of these. It helps your doctor choose treatment.</p>
        <div className="space-y-3">
          {FAMILY_HISTORY.map((f) => (
            <div key={f.id} className="border-b border-border pb-3 last:border-0">
              <div className="text-sm font-medium mb-1">{f.label}</div>
              <div className="flex flex-wrap gap-4">
                {RELATIVES.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={fh(f.id)?.relatives.includes(r.id) ?? false} onCheckedChange={(v) => toggleRelative(f.id, r.id, v === true)} data-testid={`fh-${f.id}-${r.id}`} />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => save.mutate(p)} disabled={save.isPending} data-testid="button-save-profile">
          Save profile
        </Button>
      </div>

      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold">MIDAS — how migraine affects your life</h2>
        <p className="text-sm text-muted-foreground">
          Doctors use this to decide on preventive treatment. Take it every 3 months.
          {latest && ` Last score: ${latest.answers.reduce((s, n) => s + n, 0)} on ${latest.date}.`}
        </p>
        {MIDAS_QUESTIONS.map((question, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Label htmlFor={`midas-${i}`} className="font-normal text-sm">
              {question}
            </Label>
            <Input id={`midas-${i}`} className="w-20" type="number" min={0} max={92} value={midas[i]} onChange={(e) => setMidas(midas.map((v, j) => (j === i ? Math.max(0, Math.min(92, Number(e.target.value) || 0)) : v)))} />
          </div>
        ))}
        <div className="flex items-center justify-between">
          <span className="text-sm">
            Score {midasTotal}: {midasGrade(midasTotal).label}
          </span>
          <Button onClick={() => saveMidas.mutate()} disabled={saveMidas.isPending}>
            Save MIDAS
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold">Your data</h2>
        <p className="text-sm text-muted-foreground">Your data is only visible to you when signed in. You can take a copy or delete it at any time.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/api/export/json">Download all my data (JSON)</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/export/ml-data">Download research CSV</a>
          </Button>
          <Button variant="outline" onClick={() => loadDemo.mutate()} title="Development servers only">
            Load demo data
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (window.confirm("Delete all your data permanently? This cannot be undone.")) deleteAll.mutate();
            }}
          >
            Delete all my data
          </Button>
        </div>
      </Card>
    </div>
  );
}
