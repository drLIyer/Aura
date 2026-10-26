import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addDays, subDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScoreCard from "@/components/ScoreCard";
import WaterIntakeCard from "@/components/WaterIntakeCard";
import SupplementCard from "@/components/SupplementCard";
import QuickActions from "@/components/QuickActions";
import TrendsChart from "@/components/TrendsChart";
import InsightsCard from "@/components/InsightsCard";
import CycleTrackerCard from "@/components/CycleTrackerCard";
import PeriodLogDialog from "@/components/PeriodLogDialog";
import MigraineProbabilityCard from "@/components/MigraineProbabilityCard";
import HealthScoreInput from "@/components/HealthScoreInput";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import type { LogSection } from "../App";

interface ParsedPeriodEntry {
  startDate: string;
  endDate?: string;
}

interface DashboardProps {
  onNavigateToLog: (section: LogSection) => void;
}

export default function Dashboard({ onNavigateToLog }: DashboardProps) {
  const [showPeriodDialog, setShowPeriodDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { toast } = useToast();
  const dateString = format(selectedDate, 'yyyy-MM-dd');

  const { data: healthMetrics } = useQuery<any>({
    queryKey: [`/api/health/today?date=${dateString}`],
  });

  const { data: waterLog } = useQuery<any[]>({
    queryKey: [`/api/water?date=${dateString}`],
  });

  const { data: supplementLog } = useQuery<any[]>({
    queryKey: [`/api/supplements?date=${dateString}`],
  });

  const { data: trendData } = useQuery<any[]>({
    queryKey: ['/api/health/trends?days=7'],
  });

  const { data: cyclePhase } = useQuery<any>({
    queryKey: ['/api/cycle/current'],
  });

  const { data: insights } = useQuery<any[]>({
    queryKey: ['/api/insights'],
  });

  const { data: migraineProbability } = useQuery<{
    probability: number;
    riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
    factors: { name: string; impact: 'positive' | 'negative' | 'neutral'; value: number; contribution: number; }[];
  }>({
    queryKey: [`/api/migraine-probability?date=${dateString}`],
  });

  const todayScores = {
    readiness: healthMetrics?.readiness ?? undefined,
    sleep: healthMetrics?.sleep ?? undefined,
    stress: healthMetrics?.stress ?? undefined
  };

  const waterIntake = waterLog?.reduce((sum: number, entry: any) => sum + entry.amount, 0) ?? 0;
  const waterGoal = 2000;

  const waterEntries = waterLog?.map((entry: any) => ({
    time: new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    amount: entry.amount
  })) ?? [];

  const supplementEntries = supplementLog?.map((entry: any) => ({
    name: entry.name
  })) ?? [];

  const trends = trendData?.map((d: any) => ({
    date: d.date,
    readiness: d.readiness,
    sleep: d.sleep,
    stress: d.stress,
    migraine: 0
  })) ?? [];

  const displayInsights = insights ?? [
    {
      type: 'info' as const,
      title: 'Welcome',
      message: 'Start logging your water, supplements, and meals to get personalized insights!'
    }
  ];

  const addCycleMutation = useMutation({
    mutationFn: (data: { startDate: string; endDate?: string }) => {
      return apiRequest('/api/cycle', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cycle'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cycle/current'] });
      setShowPeriodDialog(false);
      toast({ title: "Period logged successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to log period", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  const saveHealthScoresMutation = useMutation({
    mutationFn: (data: { readiness: number; sleep: number; stress: number }) => {
      return apiRequest('/api/health', 'POST', { ...data, date: dateString });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/health/today?date=${dateString}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/migraine-probability?date=${dateString}`] });
      toast({ title: "Health scores saved successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to save health scores", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  const handleQuickAction = (action: string) => {
    onNavigateToLog(action as LogSection);
  };

  const handleLogPeriod = () => {
    setShowPeriodDialog(true);
  };

  const handleLogPeriodManual = (startDate: string, endDate?: string) => {
    addCycleMutation.mutate({ startDate, endDate });
  };

  const handleImportFromDevice = async (entries: ParsedPeriodEntry[]) => {
    let successCount = 0;
    for (const entry of entries) {
      try {
        await apiRequest('/api/cycle', 'POST', entry);
        successCount++;
      } catch {
        // Continue with other entries
      }
    }
    queryClient.invalidateQueries({ queryKey: ['/api/cycle'] });
    queryClient.invalidateQueries({ queryKey: ['/api/cycle/current'] });
    setShowPeriodDialog(false);
    toast({ 
      title: "Import Complete", 
      description: `Successfully imported ${successCount} of ${entries.length} period entries.` 
    });
  };

  const handlePreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const handleNextDay = () => {
    const tomorrow = addDays(new Date(), 1);
    if (addDays(selectedDate, 1) <= tomorrow) {
      setSelectedDate(prev => addDays(prev, 1));
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      setSelectedDate(newDate);
    }
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  const formattedDate = format(selectedDate, "EEEE, MMMM d, yyyy");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground mt-1" data-testid="text-current-date">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handlePreviousDay}
            data-testid="button-prev-day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={handleDateChange}
            max={format(new Date(), 'yyyy-MM-dd')}
            className="w-40"
            data-testid="input-date-picker"
          />
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleNextDay}
            disabled={isToday}
            data-testid="button-next-day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSelectedDate(new Date())}
              data-testid="button-today"
            >
              Today
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {migraineProbability && (
          <MigraineProbabilityCard
            probability={migraineProbability.probability}
            riskLevel={migraineProbability.riskLevel}
            factors={migraineProbability.factors}
          />
        )}
        <HealthScoreInput
          currentScores={todayScores}
          onSave={(scores) => saveHealthScoresMutation.mutate(scores)}
          isPending={saveHealthScoresMutation.isPending}
        />
      </div>

      <QuickActions onAction={handleQuickAction} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CycleTrackerCard
          currentDay={cyclePhase?.currentDay ?? null}
          cycleLength={cyclePhase?.cycleLength ?? null}
          phase={cyclePhase?.phase ?? null}
          daysUntilPeriod={cyclePhase?.daysUntilPeriod ?? null}
          onLogPeriod={handleLogPeriod}
        />
        <SupplementCard supplementLog={supplementEntries} />
      </div>

      <WaterIntakeCard waterIntake={waterIntake} waterGoal={waterGoal} waterLog={waterEntries} />

      {trends.length > 0 && <TrendsChart data={trends} days={7} />}

      <InsightsCard insights={displayInsights} />

      <PeriodLogDialog
        open={showPeriodDialog}
        onOpenChange={setShowPeriodDialog}
        onLogManual={handleLogPeriodManual}
        onImportFromDevice={handleImportFromDevice}
        isLoading={addCycleMutation.isPending}
      />
    </div>
  );
}
