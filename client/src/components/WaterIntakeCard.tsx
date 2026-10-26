import { Droplets } from "lucide-react";
import { Card } from "@/components/ui/card";

interface WaterEntry {
  time: string;
  amount: number;
}

interface WaterIntakeCardProps {
  waterIntake: number;
  waterGoal: number;
  waterLog: WaterEntry[];
}

export default function WaterIntakeCard({ waterIntake, waterGoal, waterLog }: WaterIntakeCardProps) {
  const percentage = Math.min((waterIntake / waterGoal) * 100, 100);

  return (
    <Card className="p-6" data-testid="card-water-intake">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-chart-2" />
          <h2 className="text-lg font-semibold text-foreground">Water Intake Today</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {waterIntake}ml / {waterGoal}ml
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-4 mb-4">
        <div
          className="bg-gradient-to-r from-blue-400 to-blue-600 h-4 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="space-y-2">
        {waterLog.map((entry, idx) => (
          <div key={idx} className="flex justify-between items-center text-sm text-muted-foreground" data-testid={`water-entry-${idx}`}>
            <span>{entry.time}</span>
            <span className="font-medium text-chart-2">{entry.amount}ml</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
