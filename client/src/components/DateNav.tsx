import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shiftDate, todayLocal } from "@/lib/dates";

/** Picks a local calendar date; never goes past today. */
export default function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = todayLocal();
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => onChange(shiftDate(date, -1))} data-testid="button-prev-day">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Input
        type="date"
        value={date}
        max={today}
        onChange={(e) => e.target.value && e.target.value <= today && onChange(e.target.value)}
        className="w-40"
        aria-label="Date"
        data-testid="input-date-picker"
      />
      <Button variant="outline" size="icon" aria-label="Next day" disabled={date >= today} onClick={() => onChange(shiftDate(date, 1))} data-testid="button-next-day">
        <ChevronRight className="h-4 w-4" />
      </Button>
      {date !== today && (
        <Button variant="ghost" size="sm" onClick={() => onChange(today)} data-testid="button-today">
          Today
        </Button>
      )}
    </div>
  );
}
