import { Activity, Droplets, Utensils, Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QuickActionsProps {
  onAction: (action: string) => void;
}

export default function QuickActions({ onAction }: QuickActionsProps) {
  const actions = [
    { icon: Activity, label: 'Log Supplements', action: 'supplements', color: 'text-primary' },
    { icon: Droplets, label: 'Log Water', action: 'water', color: 'text-chart-2' },
    { icon: Utensils, label: 'Log Meal', action: 'meal', color: 'text-chart-3' },
    { icon: Brain, label: 'Log Migraine', action: 'migraine', color: 'text-destructive' },
  ];

  return (
    <Card className="p-6" data-testid="card-quick-actions">
      <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {actions.map(({ icon: Icon, label, action, color }) => (
          <Button
            key={action}
            variant="outline"
            className="flex flex-col items-center justify-center h-auto py-4 gap-2 hover-elevate"
            onClick={() => onAction(action)}
            data-testid={`button-quick-${action}`}
          >
            <Icon className={`w-5 h-5 ${color}`} />
            <span className="text-sm font-medium">{label}</span>
          </Button>
        ))}
      </div>
    </Card>
  );
}
