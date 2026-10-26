import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Calendar, Droplets, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AttackForm from "@/components/AttackForm";
import DateNav from "@/components/DateNav";
import LoggingPanel from "@/components/LoggingPanel";
import PeriodLogDialog from "@/components/PeriodLogDialog";
import { useToast } from "@/hooks/use-toast";
import { formatLocalDateTime, nowLocalTime, parseLocalDate, todayLocal } from "@/lib/dates";
import { apiJson, invalidateAll } from "@/lib/queryClient";
import type { Attack, Medication, Period, ProfileRecord, QuickLog, Supplement } from "@/lib/types";
import type { AttackInput } from "@shared/api";
import type { LogSection, View } from "../App";

type Water = QuickLog & { amount: number };
type Meal = QuickLog & { type: string; localTime: string | null };
type Intake = QuickLog & { name: string; dosage: string };

interface Props {
  date: string;
  onDateChange: (d: string) => void;
  initialSection?: LogSection;
  onSectionHandled?: () => void;
  onNavigate: (view: View) => void;
}

const timeOf = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function Log({ date, onDateChange, initialSection, onSectionHandled, onNavigate }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<Attack | "new" | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [mealTime, setMealTime] = useState(nowLocalTime());
  const refs = { water: useRef<HTMLDivElement>(null), meal: useRef<HTMLDivElement>(null), supplements: useRef<HTMLDivElement>(null) };
  const q = `?date=${date}`;

  useEffect(() => {
    if (!initialSection) return;
    if (initialSection === "migraine") setEditing("new");
    else refs[initialSection]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    onSectionHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection]);

  useEffect(() => setMealTime(date === todayLocal() ? nowLocalTime() : "12:30"), [date]);

  const { data: water = [] } = useQuery<Water[]>({ queryKey: [`/api/water${q}`] });
  const { data: meals = [] } = useQuery<Meal[]>({ queryKey: [`/api/meals${q}`] });
  const { data: intake = [] } = useQuery<Intake[]>({ queryKey: [`/api/supplement-intake${q}`] });
  const { data: periods = [] } = useQuery<Period[]>({ queryKey: ["/api/cycle"] });
  const { data: attacks = [] } = useQuery<Attack[]>({ queryKey: ["/api/attacks"] });
  const { data: medications = [] } = useQuery<Medication[]>({ queryKey: ["/api/medications"] });
  const { data: supplements = [] } = useQuery<Supplement[]>({ queryKey: ["/api/supplements"] });
  const { data: profile } = useQuery<ProfileRecord>({ queryKey: ["/api/profile"] });

  const write = (title: string) => ({
    onSuccess: () => {
      invalidateAll();
      toast({ title });
    },
    onError: (e: Error) => toast({ title: "Something went wrong", description: e.message, variant: "destructive" }),
  });

  const addWater = useMutation({ mutationFn: (amount: number) => apiJson("/api/water", "POST", { amount, localDate: date }), ...write("Water logged") });
  const addMeal = useMutation({ mutationFn: (type: string) => apiJson("/api/meals", "POST", { type, localDate: date, localTime: mealTime }), ...write("Meal logged") });
  const addIntake = useMutation({
    mutationFn: (s: Supplement) => apiJson("/api/supplement-intake", "POST", { name: s.name, dosage: s.dailyMg ? `${s.dailyMg} mg` : "", localDate: date }),
    ...write("Supplement logged"),
  });
  const remove = useMutation({ mutationFn: (url: string) => apiJson(url, "DELETE"), ...write("Removed") });
  const addPeriods = useMutation({
    mutationFn: (entries: { startDate: string; endDate?: string }[]) => apiJson("/api/cycle/import", "POST", { entries }),
    onSuccess: () => {
      setPeriodOpen(false);
      invalidateAll();
      toast({ title: "Periods saved" });
    },
    onError: (e: Error) => toast({ title: "Couldn't save periods", description: e.message, variant: "destructive" }),
  });
  const saveAttack = useMutation({
    mutationFn: (data: AttackInput) => (editing && editing !== "new" ? apiJson(`/api/attacks/${editing.id}`, "PUT", data) : apiJson("/api/attacks", "POST", data)),
    onSuccess: () => {
      setEditing(null);
      invalidateAll();
      toast({ title: "Attack saved", description: "Thanks — this feeds your forecast and your doctor's report." });
    },
    onError: (e: Error) => toast({ title: "Couldn't save attack", description: e.message, variant: "destructive" }),
  });

  if (editing) {
    const { id: _id, ...initial } = editing === "new" ? ({} as Attack) : editing;
    return (
      <div className="max-w-3xl mx-auto">
        <AttackForm
          medications={medications}
          customTriggers={profile?.patterns.customTriggers}
          initial={editing === "new" ? undefined : (initial as AttackInput)}
          onSubmit={(d) => saveAttack.mutate(d)}
          onCancel={() => setEditing(null)}
          onManageMedications={() => onNavigate("medications")}
          isSaving={saveAttack.isPending}
        />
      </div>
    );
  }

  const medName = new Map(medications.map((m) => [m.id, m.name]));
  const needsRating = attacks.filter((a) => a.doses.some((d) => !d.reliefAt2h)).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Log</h1>
        <DateNav date={date} onChange={onDateChange} />
      </div>

      <div className="flex justify-center">
        <Button size="lg" variant="destructive" onClick={() => setEditing("new")} data-testid="button-log-migraine-episode">
          Log a migraine attack
        </Button>
      </div>

      {needsRating.length > 0 && (
        <Card className="p-5 border-primary/40 bg-primary/5">
          <h2 className="font-semibold mb-2">How did your medicine work?</h2>
          <p className="text-sm text-muted-foreground mb-3">Rating relief 2 hours after a dose shows whether your treatment is working.</p>
          <div className="space-y-2">
            {needsRating.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span>{formatLocalDateTime(a.start)}</span>
                <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                  Rate relief
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div ref={refs.water}>
          <LoggingPanel
            title="Water"
            icon={<Droplets className="w-5 h-5 text-chart-2" />}
            entries={water.map((w) => ({ id: w.id, time: timeOf(w.timestamp), value: `${w.amount} ml` }))}
            quickAddOptions={[
              { label: "250 ml", value: "250" },
              { label: "500 ml", value: "500" },
              { label: "750 ml", value: "750" },
            ]}
            onAdd={(v) => addWater.mutate(Number(v))}
            onRemove={(id) => remove.mutate(`/api/water/${id}`)}
          />
        </div>

        <div ref={refs.meal}>
          <LoggingPanel
            title="Meals"
            icon={<Utensils className="w-5 h-5 text-chart-3" />}
            entries={meals.map((m) => ({ id: m.id, time: m.localTime ?? timeOf(m.timestamp), value: m.type }))}
            quickAddOptions={["Breakfast", "Lunch", "Dinner", "Snack"].map((t) => ({ label: t, value: t }))}
            onAdd={(t) => addMeal.mutate(t)}
            onRemove={(id) => remove.mutate(`/api/meals/${id}`)}
          >
            <label className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              Eaten at
              <Input type="time" className="w-28" value={mealTime} onChange={(e) => setMealTime(e.target.value)} aria-label="Meal time" />
            </label>
          </LoggingPanel>
        </div>

        <div ref={refs.supplements}>
          <LoggingPanel
            title="Supplements"
            icon={<Activity className="w-5 h-5 text-primary" />}
            entries={intake.map((i) => ({ id: i.id, time: timeOf(i.timestamp), value: `${i.name}${i.dosage ? ` (${i.dosage})` : ""}` }))}
            quickAddOptions={supplements.filter((s) => s.active).map((s) => ({ label: s.name, value: s.id }))}
            onAdd={(id) => {
              const s = supplements.find((x) => x.id === id);
              if (s) addIntake.mutate(s);
            }}
            onRemove={(id) => remove.mutate(`/api/supplement-intake/${id}`)}
            emptyMessage={supplements.length ? "None logged for this day" : "Add your supplements on the Medications page"}
          />
        </div>

        <LoggingPanel
          title="Periods"
          icon={<Calendar className="w-5 h-5 text-pink-500" />}
          entries={[...periods]
            .reverse()
            .slice(0, 6)
            .map((p) => ({
              id: p.id,
              time: parseLocalDate(p.startDate).toLocaleDateString(),
              value: p.endDate ? `to ${parseLocalDate(p.endDate).toLocaleDateString()}` : "Started",
            }))}
          quickAddOptions={[{ label: "Log or import", value: "open" }]}
          onAdd={() => setPeriodOpen(true)}
          onRemove={(id) => remove.mutate(`/api/cycle/${id}`)}
        />
      </div>

      <Card className="p-6" data-testid="card-attack-history">
        <h2 className="text-lg font-semibold mb-4">Recent attacks</h2>
        {attacks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attacks logged yet.</p>
        ) : (
          <div className="space-y-2">
            {attacks.slice(0, 15).map((a) => (
              <button key={a.id} onClick={() => setEditing(a)} className="w-full text-left flex items-center justify-between p-3 bg-muted rounded-md hover-elevate" data-testid={`attack-${a.id}`}>
                <div>
                  <div className="font-medium">{formatLocalDateTime(a.start)}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.doses.length ? a.doses.map((d) => `${medName.get(d.medicationId) ?? "medicine"}${d.reliefAt2h ? ` → ${d.reliefAt2h}` : ""}`).join(", ") : "No medicine logged"}
                  </div>
                </div>
                <span className="text-lg font-bold text-destructive">{a.peakSeverity}/10</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <PeriodLogDialog
        open={periodOpen}
        onOpenChange={setPeriodOpen}
        onLogManual={(startDate, endDate) => addPeriods.mutate([{ startDate, endDate }])}
        onImportFromDevice={(entries) => addPeriods.mutate(entries)}
        isLoading={addPeriods.isPending}
      />
    </div>
  );
}
