import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { TRIGGERS, WARNING_SIGNS } from "@shared/engine/domain/catalog";
import type { DailyLogInput } from "@shared/api";
import type { CheckIn } from "@/lib/types";
import ChipPicker from "./ChipPicker";

/** Exposures worth a daily tick; the rest are captured per attack. */
const DAILY_EXPOSURES = [
  "menstruation", "conflict", "skipped-meal", "alcohol", "weather", "travel", "dehydration", "caffeine-excess", "caffeine-withdrawal",
  "screen-time", "bright-light", "strong-smell", "intense-exercise", "not-rested", "stress-letdown",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  initial?: CheckIn | null;
  extraExposures?: { id: string; label: string }[];
  onSave: (data: DailyLogInput) => void;
  isSaving?: boolean;
}

const num = (v: string) => (v === "" ? undefined : Number(v));

export default function CheckInDialog({ open, onOpenChange, date, initial, extraExposures = [], onSave, isSaving }: Props) {
  const [f, setF] = useState<DailyLogInput>({ exposures: [], warningSigns: [], headache: false });
  useEffect(() => {
    if (open) setF(initial ? { ...initial } : { exposures: [], warningSigns: [], headache: false });
  }, [open, initial]);
  const set = <K extends keyof DailyLogInput>(k: K, v: DailyLogInput[K]) => setF((p) => ({ ...p, [k]: v }));

  const exposureOptions = [...TRIGGERS.filter((t) => DAILY_EXPOSURES.includes(t.id)), ...extraExposures];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Daily check-in</DialogTitle>
          <DialogDescription>Under a minute. Fill in what you know — every field is optional. Good days count as much as bad ones.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ci-sleep">Sleep last night (hours)</Label>
              <Input id="ci-sleep" type="number" step="0.5" min={0} max={24} value={f.sleepHours ?? ""} onChange={(e) => set("sleepHours", num(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="ci-lunch">Lunch time</Label>
              <Input id="ci-lunch" type="time" value={f.lunchTime ?? ""} onChange={(e) => set("lunchTime", e.target.value || undefined)} />
            </div>
            <div>
              <Label htmlFor="ci-sleepscore">Sleep score (0–100, from your device)</Label>
              <Input id="ci-sleepscore" type="number" min={0} max={100} value={f.sleepScore ?? ""} onChange={(e) => set("sleepScore", num(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="ci-ready">Readiness score (0–100)</Label>
              <Input id="ci-ready" type="number" min={0} max={100} value={f.readinessScore ?? ""} onChange={(e) => set("readinessScore", num(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="ci-work">Work hours</Label>
              <Input id="ci-work" type="number" step="0.5" min={0} max={24} value={f.workHours ?? ""} onChange={(e) => set("workHours", num(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="ci-caff">Caffeine (mg, ~95 per coffee)</Label>
              <Input id="ci-caff" type="number" min={0} max={3000} value={f.caffeineMg ?? ""} onChange={(e) => set("caffeineMg", num(e.target.value))} />
            </div>
          </div>

          <div>
            <div className="flex justify-between">
              <Label>Stress today</Label>
              <span className="text-sm text-muted-foreground" data-testid="text-stress-value">
                {f.stress === undefined ? "not set" : `${f.stress} / 10`}
              </span>
            </div>
            <Slider className="mt-3" min={0} max={10} step={1} value={[f.stress ?? 0]} onValueChange={([v]) => set("stress", v)} aria-label="Stress, 0 none to 10 extreme" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0 · calm</span>
              <span>10 · extreme stress</span>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Anything today?</Label>
            <ChipPicker options={exposureOptions} value={f.exposures} onChange={(v) => set("exposures", v)} testId="checkin-exposures" />
          </div>

          <div>
            <Label className="mb-2 block">Early warning signs</Label>
            <ChipPicker options={WARNING_SIGNS} value={f.warningSigns} onChange={(v) => set("warningSigns", v)} testId="checkin-warning-signs" />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="ci-headache">Any headache today?</Label>
            <Switch id="ci-headache" checked={f.headache} onCheckedChange={(v) => set("headache", v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(f)} disabled={isSaving} data-testid="button-save-checkin">
            Save check-in for {date}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
