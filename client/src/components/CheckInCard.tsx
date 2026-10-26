import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CheckIn } from "@/lib/types";

export default function CheckInCard({ checkIn, onOpen }: { checkIn?: CheckIn | null; onOpen: () => void }) {
  const items = checkIn
    ? [
        checkIn.sleepHours !== undefined && ["Sleep", `${checkIn.sleepHours} h`],
        checkIn.sleepScore !== undefined && ["Sleep score", String(checkIn.sleepScore)],
        checkIn.readinessScore !== undefined && ["Readiness", String(checkIn.readinessScore)],
        checkIn.stress !== undefined && ["Stress", `${checkIn.stress}/10`],
        checkIn.lunchTime && ["Lunch", checkIn.lunchTime],
        checkIn.workHours !== undefined && ["Work", `${checkIn.workHours} h`],
      ].filter((x): x is [string, string] => Boolean(x))
    : [];
  return (
    <Card className="p-6" data-testid="card-checkin">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Daily check-in</h2>
        </div>
        <Button variant="outline" size="sm" onClick={onOpen} data-testid="button-open-checkin">
          {checkIn ? "Edit" : "Check in"}
        </Button>
      </div>
      {checkIn ? (
        <div className="grid grid-cols-3 gap-3 text-center">
          {items.map(([k, v]) => (
            <div key={k}>
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="text-lg font-semibold">{v}</p>
            </div>
          ))}
          {items.length === 0 && <p className="col-span-3 text-sm text-muted-foreground">Checked in.</p>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          Not checked in for this day yet. Sleep, stress, lunch time and anything unusual — it takes under a minute and powers your forecast.
        </p>
      )}
    </Card>
  );
}
