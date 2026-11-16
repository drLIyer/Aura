import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import CheckInCard from "@/components/CheckInCard";
import NoticedCard from "@/components/assist/NoticedCard";
import CheckInDialog from "@/components/CheckInDialog";
import CycleTrackerCard from "@/components/CycleTrackerCard";
import { useCycleTracking } from "@/lib/cycle";
import DateNav from "@/components/DateNav";
import ForecastCard from "@/components/ForecastCard";
import PeriodLogDialog from "@/components/PeriodLogDialog";
import QuickActions from "@/components/QuickActions";
import RecommendationsCard from "@/components/RecommendationsCard";
import SupplementCard from "@/components/SupplementCard";
import TrendsChart from "@/components/TrendsChart";
import UrgentBanner from "@/components/UrgentBanner";
import WaterIntakeCard from "@/components/WaterIntakeCard";
import { useToast } from "@/hooks/use-toast";
import { formatLongDate, todayLocal } from "@/lib/dates";
import { apiJson, invalidateAll } from "@/lib/queryClient";
import type { CheckIn, CycleStatus, Forecast, ProfileRecord, QuickLog, Recommendation, Supplement } from "@/lib/types";
import type { DailyLogInput } from "@shared/api";
import type { LogSection, View } from "../App";

interface Props {
  date: string;
  onDateChange: (d: string) => void;
  onNavigate: (view: View, section?: LogSection) => void;
}

type SupplementIntake = QuickLog & { name: string; dosage: string };
type Water = QuickLog & { amount: number };

export default function Dashboard({ date, onDateChange, onNavigate }: Props) {
  const { toast } = useToast();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const q = `?date=${date}`;

  const { data: profile } = useQuery<ProfileRecord>({ queryKey: ["/api/profile"] });
  const tracksCycle = useCycleTracking();
  const { data: forecast } = useQuery<Forecast>({ queryKey: [`/api/forecast${q}`] });
  const { data: recs = [] } = useQuery<Recommendation[]>({ queryKey: [`/api/recommendations${q}&audience=patient`] });
  const { data: checkIn } = useQuery<CheckIn | null>({ queryKey: [`/api/checkins/${date}`] });
  const { data: cycle } = useQuery<CycleStatus | null>({ queryKey: [`/api/cycle/current${q}`] });
  const { data: water = [] } = useQuery<Water[]>({ queryKey: [`/api/water${q}`] });
  const { data: supplements = [] } = useQuery<Supplement[]>({ queryKey: ["/api/supplements"] });
  const { data: intake = [] } = useQuery<SupplementIntake[]>({ queryKey: [`/api/supplement-intake${q}`] });
  const { data: trends = [] } = useQuery<{ date: string; readiness: number | null; sleep: number | null; stress: number | null; migraine: number }[]>({
    queryKey: [`/api/trends${q}&days=14`],
  });

  const onError = (title: string) => (e: Error) => toast({ title, description: e.message, variant: "destructive" });

  const saveCheckIn = useMutation({
    mutationFn: (data: DailyLogInput) => apiJson(`/api/checkins/${date}`, "PUT", data),
    onSuccess: () => {
      setCheckInOpen(false);
      invalidateAll();
      toast({ title: "Check-in saved" });
    },
    onError: onError("Couldn't save check-in"),
  });

  const logPeriod = useMutation({
    mutationFn: (entries: { startDate: string; endDate?: string }[]) => apiJson<{ added: number; skipped?: number }>("/api/cycle/import", "POST", { entries }),
    onSuccess: (r, entries) => {
      setPeriodOpen(false);
      invalidateAll();
      toast({ title: entries.length > 1 ? `Imported ${r.added} periods` : "Period logged", description: r.skipped ? `${r.skipped} already logged were skipped.` : undefined });
    },
    onError: onError("Couldn't log period"),
  });

  const toggleSupplement = useMutation({
    mutationFn: async (s: Supplement) => {
      const existing = intake.find((i) => i.name === s.name);
      if (existing) return apiJson(`/api/supplement-intake/${existing.id}`, "DELETE");
      return apiJson("/api/supplement-intake", "POST", { name: s.name, dosage: s.dailyMg ? `${s.dailyMg} mg` : "", localDate: date });
    },
    onSuccess: () => invalidateAll(),
    onError: onError("Couldn't update supplements"),
  });

  const intakeIncomplete = profile && !profile.patterns.completedAt;
  const waterTotal = water.reduce((s, w) => s + w.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">
            {date === todayLocal() ? "Today" : "Day view"}
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-current-date">
            {formatLongDate(date)}
          </p>
        </div>
        <DateNav date={date} onChange={onDateChange} />
      </div>

      <UrgentBanner recommendations={recs} />

      {intakeIncomplete && (
        <Card className="p-5 border-primary/40 bg-primary/5 flex flex-wrap items-center justify-between gap-3" data-testid="card-intake-prompt">
          <div>
            <h2 className="font-semibold">Tell us about your migraines</h2>
            <p className="text-sm text-muted-foreground">What sets yours off, what helps, your early warning signs. Five minutes, and your forecast starts from your own experience.</p>
          </div>
          <Button onClick={() => onNavigate("patterns")}>Start</Button>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {forecast && <ForecastCard forecast={forecast} />}
        <CheckInCard checkIn={checkIn} onOpen={() => setCheckInOpen(true)} />
      </div>

      <QuickActions onAction={(a) => onNavigate("log", a as LogSection)} />

      <NoticedCard limit={3} onSeeAll={() => onNavigate("memory")} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tracksCycle && <CycleTrackerCard status={cycle} onLogPeriod={() => setPeriodOpen(true)} />}
        <SupplementCard supplements={supplements} takenNames={intake.map((i) => i.name)} onToggle={(s) => toggleSupplement.mutate(s)} onManage={() => onNavigate("medications")} />
      </div>

      <WaterIntakeCard
        waterIntake={waterTotal}
        waterGoal={2000}
        waterLog={water.map((w) => ({ time: new Date(w.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), amount: w.amount }))}
      />

      {trends.some((t) => t.readiness !== null || t.sleep !== null || t.stress !== null || t.migraine) && <TrendsChart data={trends} days={14} />}

      <RecommendationsCard recommendations={recs.filter((r) => r.severity !== "urgent")} limit={6} />

      <CheckInDialog
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        date={date}
        initial={checkIn}
        extraExposures={profile?.patterns.customTriggers ?? []}
        onSave={(d) => saveCheckIn.mutate(d)}
        isSaving={saveCheckIn.isPending}
      />
      <PeriodLogDialog
        open={periodOpen}
        onOpenChange={setPeriodOpen}
        onLogManual={(startDate, endDate) => logPeriod.mutate([{ startDate, endDate }])}
        onImportFromDevice={(entries) => logPeriod.mutate(entries)}
        isLoading={logPeriod.isPending}
      />
    </div>
  );
}
