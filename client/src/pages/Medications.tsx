import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { todayLocal } from "@/lib/dates";
import { apiJson, invalidateAll } from "@/lib/queryClient";
import type { Medication, Supplement } from "@/lib/types";
import { MEDICATION_CATALOG, MEDICATION_CLASS_LABELS, SUPPLEMENT_CATALOG } from "@shared/engine/domain/catalog";
import { MEDICATION_CLASSES, type MedicationInput, type SupplementInput } from "@shared/api";

const ROLE_LABEL = { acute: "For attacks", preventive: "Preventive", other: "Other condition" } as const;

const blankMed = (): MedicationInput => ({ name: "", cls: "other", role: "other", overTheCounter: false, active: true, startDate: todayLocal() });

function MedicationForm({ onSave, saving }: { onSave: (m: MedicationInput) => void; saving: boolean }) {
  const [m, setM] = useState<MedicationInput>(blankMed());
  const set = <K extends keyof MedicationInput>(k: K, v: MedicationInput[K]) => setM((p) => ({ ...p, [k]: v }));
  const pickName = (name: string) => {
    const known = MEDICATION_CATALOG.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    setM((p) => ({ ...p, name, ...(known ? { cls: known.cls, role: known.role } : {}) }));
  };
  return (
    <div className="space-y-4" data-testid="form-medication">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label htmlFor="med-name">Medicine name</Label>
          <Input id="med-name" list="med-catalog" placeholder="Start typing, e.g. sumatriptan, sertraline, the pill…" value={m.name} onChange={(e) => pickName(e.target.value)} />
          <datalist id="med-catalog">
            {MEDICATION_CATALOG.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
        </div>
        <div>
          <Label>Type of medicine</Label>
          <Select value={m.cls} onValueChange={(v) => set("cls", v as MedicationInput["cls"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEDICATION_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {MEDICATION_CLASS_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Used for</Label>
          <Select value={m.role} onValueChange={(v) => set("role", v as MedicationInput["role"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="acute">Treating migraine attacks</SelectItem>
              <SelectItem value="preventive">Preventing migraine</SelectItem>
              <SelectItem value="other">Another condition</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="med-dose">Dose</Label>
          <Input id="med-dose" placeholder="e.g. 50 mg" value={m.dose ?? ""} onChange={(e) => set("dose", e.target.value || undefined)} />
        </div>
        <div>
          <Label htmlFor="med-freq">How often</Label>
          <Input id="med-freq" placeholder="e.g. once daily, at onset" value={m.frequency ?? ""} onChange={(e) => set("frequency", e.target.value || undefined)} />
        </div>
        <div>
          <Label>Regular or as needed</Label>
          <Select value={m.schedule ?? "unset"} onValueChange={(v) => set("schedule", v === "unset" ? undefined : (v as MedicationInput["schedule"]))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">—</SelectItem>
              <SelectItem value="regular">On a schedule</SelectItem>
              <SelectItem value="as-needed">Only when needed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="med-start">Started</Label>
          <Input id="med-start" type="date" max={todayLocal()} value={m.startDate ?? ""} onChange={(e) => set("startDate", e.target.value || undefined)} />
        </div>
        <div>
          <Label htmlFor="med-reason">What it's for (in your words)</Label>
          <Input id="med-reason" value={m.reason ?? ""} onChange={(e) => set("reason", e.target.value || undefined)} />
        </div>
        <div>
          <Label htmlFor="med-prescriber">Prescribed by</Label>
          <Input id="med-prescriber" value={m.prescriber ?? ""} onChange={(e) => set("prescriber", e.target.value || undefined)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={m.overTheCounter} onCheckedChange={(v) => set("overTheCounter", v === true)} /> Bought without a prescription
      </label>
      <Button
        disabled={!m.name.trim() || saving}
        onClick={() => {
          onSave(m);
          setM(blankMed());
        }}
        data-testid="button-save-medication"
      >
        Add medicine
      </Button>
    </div>
  );
}

export default function Medications() {
  const { toast } = useToast();
  const { data: meds = [] } = useQuery<Medication[]>({ queryKey: ["/api/medications"] });
  const { data: supplements = [] } = useQuery<Supplement[]>({ queryKey: ["/api/supplements"] });
  const [supp, setSupp] = useState<SupplementInput>({ kind: "magnesium", name: "Magnesium", active: true });

  const onError = (e: Error) => toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
  const done = (title: string) => () => {
    invalidateAll();
    toast({ title });
  };
  const addMed = useMutation({ mutationFn: (m: MedicationInput) => apiJson("/api/medications", "POST", m), onSuccess: done("Medicine added — checked against your list"), onError });
  const stopMed = useMutation({
    mutationFn: (m: Medication) => {
      const { id, ...rest } = m;
      return apiJson(`/api/medications/${id}`, "PUT", { ...rest, active: false, endDate: todayLocal() });
    },
    onSuccess: done("Marked as stopped"),
    onError,
  });
  const delMed = useMutation({ mutationFn: (id: string) => apiJson(`/api/medications/${id}`, "DELETE"), onSuccess: done("Removed"), onError });
  const addSupp = useMutation({ mutationFn: (s: SupplementInput) => apiJson("/api/supplements", "POST", s), onSuccess: done("Supplement added"), onError });
  const delSupp = useMutation({ mutationFn: (id: string) => apiJson(`/api/supplements/${id}`, "DELETE"), onSuccess: done("Removed"), onError });

  const active = meds.filter((m) => m.active);
  const stopped = meds.filter((m) => !m.active);
  const suppInfo = SUPPLEMENT_CATALOG.find((s) => s.kind === supp.kind);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Medicines & supplements</h1>
        <p className="text-muted-foreground mt-1">
          List everything you take — not just migraine medicines. Many important interactions involve medicines for other conditions.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Current medicines</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">None added yet.</p>
        ) : (
          <div className="space-y-2">
            {(["acute", "preventive", "other"] as const).map((role) =>
              active
                .filter((m) => m.role === role)
                .map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted rounded-md" data-testid={`medication-${m.id}`}>
                    <div>
                      <div className="font-medium">
                        {m.name} {m.dose && <span className="text-muted-foreground font-normal">{m.dose}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ROLE_LABEL[m.role]} · {MEDICATION_CLASS_LABELS[m.cls]}
                        {m.frequency && ` · ${m.frequency}`}
                        {m.startDate && ` · since ${m.startDate}`}
                        {m.reason && ` · ${m.reason}`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => stopMed.mutate(m)}>
                        Stopped taking
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => delMed.mutate(m.id)} aria-label={`Delete ${m.name}`}>
                        Delete
                      </Button>
                    </div>
                  </div>
                )),
            )}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Add a medicine</h2>
        <MedicationForm onSave={(m) => addMed.mutate(m)} saving={addMed.isPending} />
      </Card>

      {stopped.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">Past medicines</h2>
          <ul className="text-sm space-y-1">
            {stopped.map((m) => (
              <li key={m.id} className="flex justify-between">
                <span>
                  {m.name} {m.dose}
                </span>
                <span className="text-muted-foreground">
                  {m.startDate ?? "?"} → {m.endDate ?? "?"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Supplements</h2>
        {supplements.map((s) => (
          <div key={s.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
            <span>
              {s.name} {s.dailyMg && <span className="text-muted-foreground">{s.dailyMg} mg/day</span>}
            </span>
            <Button size="sm" variant="ghost" onClick={() => delSupp.mutate(s.id)}>
              Remove
            </Button>
          </div>
        ))}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_8rem_auto] gap-2 items-end">
          <div>
            <Label>Supplement</Label>
            <Select
              value={supp.kind}
              onValueChange={(kind) => setSupp({ ...supp, kind, name: SUPPLEMENT_CATALOG.find((s) => s.kind === kind)?.label ?? supp.name })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPLEMENT_CATALOG.map((s) => (
                  <SelectItem key={s.kind} value={s.kind}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="supp-name">Product name</Label>
            <Input id="supp-name" value={supp.name} onChange={(e) => setSupp({ ...supp, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="supp-mg">mg per day</Label>
            <Input id="supp-mg" type="number" min={0} value={supp.dailyMg ?? ""} onChange={(e) => setSupp({ ...supp, dailyMg: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </div>
          <Button disabled={!supp.name.trim()} onClick={() => addSupp.mutate(supp)}>
            Add
          </Button>
        </div>
        {suppInfo && (
          <p className="text-xs text-muted-foreground">
            {suppInfo.evidence} {suppInfo.cautions}
          </p>
        )}
      </Card>
    </div>
  );
}
