import { useMemo, useState } from "react";
import { Phone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ALLEVIATORS,
  AURA_SYMPTOMS,
  EXACERBATORS,
  PAIN_LOCATIONS,
  PAIN_QUALITIES,
  RED_FLAGS,
  SYMPTOMS,
  TRIGGERS,
} from "@shared/engine/domain/catalog";
import type { AttackInput } from "@shared/api";
import { nowLocalDateTime } from "@/lib/dates";
import type { Medication } from "@/lib/types";
import ChipPicker from "./ChipPicker";
import { MENSTRUATION, useCycleTracking } from "@/lib/cycle";

type Dose = AttackInput["doses"][number];

interface Props {
  medications: Medication[];
  customTriggers?: { id: string; label: string }[];
  initial?: AttackInput;
  onSubmit: (data: AttackInput) => void;
  onCancel: () => void;
  onManageMedications: () => void;
  isSaving?: boolean;
}

export const emptyAttack = (): AttackInput => ({
  start: nowLocalDateTime(),
  peakSeverity: 5,
  painLocations: [],
  painQualities: [],
  symptoms: [],
  worsenedByActivity: false,
  triggers: [],
  alleviators: [],
  exacerbators: [],
  doses: [],
  disability: "mild",
  redFlags: [],
});

function YesNo({ value, onChange, label }: { value?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={value === true ? "default" : "outline"} onClick={() => onChange(true)}>
          Yes
        </Button>
        <Button type="button" size="sm" variant={value === false ? "default" : "outline"} onClick={() => onChange(false)}>
          No
        </Button>
      </div>
    </div>
  );
}

export default function AttackForm({ medications, customTriggers = [], initial, onSubmit, onCancel, onManageMedications, isSaving }: Props) {
  const [a, setA] = useState<AttackInput>(initial ?? emptyAttack());
  const [ongoing, setOngoing] = useState(!initial?.end);
  const tracksCycle = useCycleTracking();
  const set = <K extends keyof AttackInput>(k: K, v: AttackInput[K]) => setA((p) => ({ ...p, [k]: v }));

  const hasAura = a.symptoms.some((s) => AURA_SYMPTOMS.includes(s));
  const urgentFlags = RED_FLAGS.filter((f) => f.urgent && a.redFlags.includes(f.id));
  const medsForDoses = useMemo(
    () => [...medications.filter((m) => m.active && m.role === "acute"), ...medications.filter((m) => m.active && m.role !== "acute")],
    [medications],
  );

  const setDose = (i: number, patch: Partial<Dose>) => set("doses", a.doses.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const addDose = () => medsForDoses[0] && set("doses", [...a.doses, { medicationId: medsForDoses[0].id, takenAt: a.start }]);

  const submit = () => {
    const out: AttackInput = { ...a, end: ongoing ? undefined : a.end };
    if (!hasAura) {
      delete out.auraMinutes;
      delete out.auraOnset;
      delete out.auraSpread;
      delete out.auraUsual;
    }
    onSubmit(out);
  };

  return (
    <Card className="p-6 space-y-6" data-testid="form-attack">
      <h2 className="text-xl font-semibold">{initial ? "Edit attack" : "Log a migraine attack"}</h2>
      <p className="text-sm text-muted-foreground -mt-4">Fill in what you can now — you can come back and add details, such as how your medicine worked, later.</p>

      {urgentFlags.length > 0 && (
        <div role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 dark:bg-red-950/40 p-4 flex gap-3" data-testid="alert-red-flag">
          <Phone className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <div className="text-sm text-red-900 dark:text-red-100">
            <p className="font-semibold">Please get checked right away.</p>
            <p>
              {urgentFlags.map((f) => f.label.toLowerCase()).join("; ")}: call your local emergency number or have someone take you to the emergency
              department. Don't take a triptan until you've been checked.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="atk-start">Started</Label>
          <Input id="atk-start" type="datetime-local" value={a.start} onChange={(e) => set("start", e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="atk-end">Ended</Label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={ongoing} onCheckedChange={setOngoing} aria-label="Still going" /> Still going
            </label>
          </div>
          <Input id="atk-end" type="datetime-local" disabled={ongoing} min={a.start} value={a.end ?? ""} onChange={(e) => set("end", e.target.value || undefined)} />
        </div>
      </div>

      <div>
        <div className="flex justify-between">
          <Label>Worst pain</Label>
          <span className="text-sm font-semibold" data-testid="text-severity">
            {a.peakSeverity} / 10
          </span>
        </div>
        <Slider className="mt-3" min={0} max={10} step={1} value={[a.peakSeverity]} onValueChange={([v]) => set("peakSeverity", v)} aria-label="Worst pain, 0 to 10" />
      </div>

      <div className="space-y-2">
        <Label>Where</Label>
        <ChipPicker options={PAIN_LOCATIONS} value={a.painLocations} onChange={(v) => set("painLocations", v)} />
        <Label className="block pt-2">What it felt like</Label>
        <ChipPicker options={PAIN_QUALITIES} value={a.painQualities} onChange={(v) => set("painQualities", v)} />
        <label className="flex items-center gap-2 text-sm pt-2">
          <Switch checked={a.worsenedByActivity} onCheckedChange={(v) => set("worsenedByActivity", v)} /> Worse with movement or routine activity
        </label>
      </div>

      <div>
        <Label className="mb-2 block">Symptoms</Label>
        <ChipPicker options={SYMPTOMS} value={a.symptoms} onChange={(v) => set("symptoms", v)} testId="attack-symptoms" />
      </div>

      {hasAura && (
        <div className="rounded-lg bg-muted/60 p-4 space-y-3" data-testid="section-aura">
          <p className="text-sm font-medium">A few questions to help your doctor understand your aura</p>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="atk-aura-min" className="font-normal">
              How long did the aura last (minutes)?
            </Label>
            <Input id="atk-aura-min" className="w-24" type="number" min={0} max={1440} value={a.auraMinutes ?? ""} onChange={(e) => set("auraMinutes", e.target.value === "" ? undefined : Number(e.target.value))} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm">How did it start?</span>
            <div className="flex gap-2">
              {(["gradual", "sudden", "unsure"] as const).map((o) => (
                <Button key={o} type="button" size="sm" variant={a.auraOnset === o ? "default" : "outline"} onClick={() => set("auraOnset", o)}>
                  {o === "gradual" ? "Built up over minutes" : o === "sudden" ? "All at once" : "Not sure"}
                </Button>
              ))}
            </div>
          </div>
          <YesNo label="Did it spread or move over a few minutes?" value={a.auraSpread} onChange={(v) => set("auraSpread", v)} />
          <YesNo label="Was it like your usual aura?" value={a.auraUsual} onChange={(v) => set("auraUsual", v)} />
        </div>
      )}

      <div>
        <Label className="mb-2 block">What might have set it off?</Label>
        <ChipPicker options={[...TRIGGERS.filter((t) => tracksCycle || t.id !== MENSTRUATION || a.triggers.includes(t.id)), ...customTriggers]} value={a.triggers} onChange={(v) => set("triggers", v)} testId="attack-triggers" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Medicine taken</Label>
          {medsForDoses.length > 0 ? (
            <Button type="button" size="sm" variant="outline" onClick={addDose} data-testid="button-add-dose">
              <Plus className="w-4 h-4 mr-1" /> Add dose
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={onManageMedications}>
              Add your medicines first
            </Button>
          )}
        </div>
        {a.doses.map((d, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1.5fr_1.2fr_1fr_1.3fr_auto] gap-2 items-end" data-testid={`dose-${i}`}>
            <div>
              <Label className="text-xs text-muted-foreground">Medicine</Label>
              <Select value={d.medicationId} onValueChange={(v) => setDose(i, { medicationId: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {medsForDoses.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      {m.dose ? ` (${m.dose})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Taken at</Label>
              <Input type="datetime-local" value={d.takenAt} onChange={(e) => setDose(i, { takenAt: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Dose</Label>
              <Input placeholder="e.g. 50 mg" value={d.dose ?? ""} onChange={(e) => setDose(i, { dose: e.target.value || undefined })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">After 2 hours</Label>
              <Select value={d.reliefAt2h ?? "unknown"} onValueChange={(v) => setDose(i, { reliefAt2h: v === "unknown" ? undefined : (v as Dose["reliefAt2h"]) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Not yet / not sure</SelectItem>
                  <SelectItem value="pain-free">Pain-free</SelectItem>
                  <SelectItem value="partial">Better, not gone</SelectItem>
                  <SelectItem value="none">No better</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove dose" onClick={() => set("doses", a.doses.filter((_, j) => j !== i))}>
              <Trash2 className="w-4 h-4" />
            </Button>
            {d.reliefAt2h && d.reliefAt2h !== "none" && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-5">
                <Checkbox checked={Boolean(d.recurrence)} onCheckedChange={(v) => setDose(i, { recurrence: v === true })} /> Pain came back within 48 hours
              </label>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="mb-2 block">What helped</Label>
          <ChipPicker options={ALLEVIATORS} value={a.alleviators} onChange={(v) => set("alleviators", v)} />
        </div>
        <div>
          <Label className="mb-2 block">What made it worse</Label>
          <ChipPicker options={EXACERBATORS} value={a.exacerbators} onChange={(v) => set("exacerbators", v)} />
        </div>
      </div>

      <div>
        <Label>How much did it stop you doing things?</Label>
        <Select value={a.disability} onValueChange={(v) => set("disability", v as AttackInput["disability"])}>
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not at all</SelectItem>
            <SelectItem value="mild">A little — kept going</SelectItem>
            <SelectItem value="moderate">A lot — had to cut back</SelectItem>
            <SelectItem value="severe">Completely — had to stop or lie down</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="block">Was this headache different in any of these ways?</Label>
        <p className="text-xs text-muted-foreground">Most migraines have none of these. They help catch the rare headache that needs a doctor quickly.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RED_FLAGS.map((f) => (
            <label key={f.id} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={a.redFlags.includes(f.id)}
                onCheckedChange={(v) => set("redFlags", v === true ? [...a.redFlags, f.id] : a.redFlags.filter((x) => x !== f.id))}
                data-testid={`redflag-${f.id}`}
              />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="atk-notes">Notes</Label>
        <Textarea id="atk-notes" rows={3} value={a.notes ?? ""} onChange={(e) => set("notes", e.target.value || undefined)} />
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={isSaving || (!ongoing && Boolean(a.end) && a.end! < a.start)} data-testid="button-save-attack">
          {initial ? "Save changes" : "Save attack"}
        </Button>
      </div>
    </Card>
  );
}
