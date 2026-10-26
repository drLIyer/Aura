import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="bg-card border-b border-card-border">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-chart-2 rounded-lg flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight text-foreground sm:text-2xl">Personalized Migraine Monitor and Predictor</h1>
              <p className="text-sm text-muted-foreground">Track. Analyze. Prevent.</p>
            </div>
          </div>
          <Button 
            className="w-full sm:w-auto"
            data-testid="button-connect-wearable"
            onClick={() => console.log('Connect wearable device clicked')}
          >
            Connect your wearable device
          </Button>
        </div>
      </div>
    </header>
  );
}
