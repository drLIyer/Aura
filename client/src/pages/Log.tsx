import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Droplets, Utensils, Activity, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import LoggingPanel from "@/components/LoggingPanel";
import MigraineLogForm from "@/components/MigraineLogForm";
import PeriodLogDialog from "@/components/PeriodLogDialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { LogSection } from "../App";

interface ParsedPeriodEntry {
  startDate: string;
  endDate?: string;
}

interface LogProps {
  initialSection?: LogSection;
  onSectionHandled?: () => void;
}

export default function Log({ initialSection, onSectionHandled }: LogProps) {
  const [showMigraineForm, setShowMigraineForm] = useState(false);
  const [showPeriodDialog, setShowPeriodDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { toast } = useToast();
  
  const waterRef = useRef<HTMLDivElement>(null);
  const mealRef = useRef<HTMLDivElement>(null);
  const supplementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialSection) {
      if (initialSection === 'migraine') {
        setShowMigraineForm(true);
      } else if (initialSection === 'water' && waterRef.current) {
        waterRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (initialSection === 'meal' && mealRef.current) {
        mealRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (initialSection === 'supplements' && supplementRef.current) {
        supplementRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      onSectionHandled?.();
    }
  }, [initialSection, onSectionHandled]);
  const dateString = format(selectedDate, 'yyyy-MM-dd');
  const isToday = format(new Date(), 'yyyy-MM-dd') === dateString;

  const { data: waterLog, isLoading: waterLoading } = useQuery<any[]>({
    queryKey: [`/api/water?date=${dateString}`],
  });

  const { data: mealLog } = useQuery<any[]>({
    queryKey: ['/api/meals'],
  });

  const { data: supplementLog, isLoading: supplementLoading } = useQuery<any[]>({
    queryKey: [`/api/supplements?date=${dateString}`],
  });

  const { data: cycleLog } = useQuery<any[]>({
    queryKey: ['/api/cycle'],
  });

  const addWaterMutation = useMutation({
    mutationFn: (amount: number) => apiRequest('/api/water', 'POST', { amount, date: dateString }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/water?date=${dateString}`] });
      toast({ title: "Water logged successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to log water", variant: "destructive" });
    }
  });

  const addMealMutation = useMutation({
    mutationFn: (type: string) => apiRequest('/api/meals', 'POST', { type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meals'] });
      toast({ title: "Meal logged successfully" });
    }
  });

  const addSupplementMutation = useMutation({
    mutationFn: (data: { name: string; dosage: string }) => 
      apiRequest('/api/supplements', 'POST', { ...data, date: dateString }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supplements?date=${dateString}`] });
      toast({ title: "Supplement logged successfully" });
    }
  });

  const addMigraineMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/migraines', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/migraines'] });
      toast({ title: "Migraine logged successfully", description: "Your migraine has been recorded for analysis." });
      setShowMigraineForm(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to log migraine", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

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

  const waterEntries = waterLog?.map((entry: any) => ({
    time: new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    value: `${entry.amount}ml`
  })) ?? [];

  const mealEntries = mealLog?.map((entry: any) => ({
    time: new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    value: entry.type
  })) ?? [];

  const supplementEntries = supplementLog?.map((entry: any) => ({
    time: new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    value: `${entry.name} (${entry.dosage})`
  })) ?? [];

  const periodEntries = cycleLog?.map((entry: any) => ({
    time: new Date(entry.startDate).toLocaleDateString(),
    value: entry.endDate ? `Period ended ${new Date(entry.endDate).toLocaleDateString()}` : 'Period started'
  })) ?? [];

  const handleAddWater = (amount: string) => {
    addWaterMutation.mutate(parseInt(amount));
  };

  const handleAddMeal = (type: string) => {
    addMealMutation.mutate(type);
  };

  const handleAddSupplement = (supplement: string) => {
    const supplementMap: Record<string, { name: string; dosage: string }> = {
      'CoQ10 (300mg)': { name: 'CoQ10', dosage: '300mg' },
      'Magnesium Citrate (400mg)': { name: 'Magnesium Citrate', dosage: '400mg' },
      'Vitamin B2 (400mg)': { name: 'Vitamin B2', dosage: '400mg' },
      'Selenium (200mcg)': { name: 'Selenium', dosage: '200mcg' }
    };
    const data = supplementMap[supplement];
    if (data) {
      addSupplementMutation.mutate(data);
    }
  };

  const handleLogMigraine = (data: any) => {
    addMigraineMutation.mutate(data);
  };

  const handleAddPeriod = () => {
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

  if (showMigraineForm) {
    return (
      <div className="max-w-2xl mx-auto">
        <MigraineLogForm
          onSubmit={handleLogMigraine}
          onCancel={() => setShowMigraineForm(false)}
        />
      </div>
    );
  }

  const handlePreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-4 mb-6">
        <Button 
          size="icon" 
          variant="outline" 
          onClick={handlePreviousDay}
          data-testid="button-log-prev-day"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateString}
            onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
            className="px-3 py-2 border rounded-md bg-background"
            data-testid="input-log-date"
          />
          {!isToday && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleToday}
              data-testid="button-log-today"
            >
              Today
            </Button>
          )}
        </div>
        <Button 
          size="icon" 
          variant="outline" 
          onClick={handleNextDay}
          data-testid="button-log-next-day"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div ref={waterRef}>
          <LoggingPanel
            title="Water Log"
            icon={<Droplets className="w-5 h-5 text-chart-2" />}
            entries={waterEntries}
            quickAddOptions={[
              { label: '250ml', value: '250' },
              { label: '500ml', value: '500' },
              { label: '750ml', value: '750' }
            ]}
            onAdd={handleAddWater}
          />
        </div>

        <div ref={mealRef}>
          <LoggingPanel
            title="Meal Log"
            icon={<Utensils className="w-5 h-5 text-chart-3" />}
            entries={mealEntries}
            quickAddOptions={[
              { label: 'Breakfast', value: 'Breakfast' },
              { label: 'Lunch', value: 'Lunch' },
              { label: 'Dinner', value: 'Dinner' },
              { label: 'Snack', value: 'Snack' }
            ]}
            onAdd={handleAddMeal}
          />
        </div>

        <div ref={supplementRef}>
          <LoggingPanel
            title="Supplement Log"
            icon={<Activity className="w-5 h-5 text-primary" />}
            entries={supplementEntries}
            quickAddOptions={[
              { label: 'CoQ10', value: 'CoQ10 (300mg)' },
              { label: 'Magnesium', value: 'Magnesium Citrate (400mg)' },
              { label: 'Vitamin B2', value: 'Vitamin B2 (400mg)' },
              { label: 'Selenium', value: 'Selenium (200mcg)' }
            ]}
            onAdd={handleAddSupplement}
          />
        </div>

        <LoggingPanel
          title="Period Log"
          icon={<Calendar className="w-5 h-5 text-pink-500" />}
          entries={periodEntries}
          onAdd={handleAddPeriod}
        />
      </div>

      <div className="flex justify-center pt-6">
        <button
          onClick={() => setShowMigraineForm(true)}
          className="px-6 py-3 bg-destructive text-destructive-foreground rounded-lg font-semibold hover-elevate active-elevate-2"
          data-testid="button-log-migraine-episode"
        >
          Log Migraine Episode
        </button>
      </div>

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
