import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="bg-card border-b border-card-border">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-chart-2 rounded-lg flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Migraine Tracker</h1>
              <p className="text-sm text-muted-foreground">Track. Analyze. Prevent.</p>
            </div>
          </div>
          <Button 
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
