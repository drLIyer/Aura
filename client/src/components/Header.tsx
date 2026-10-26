import { Brain, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onConnectWearable: () => void;
  userName?: string | null;
  onLogout?: () => void;
}

export default function Header({ onConnectWearable, userName, onLogout }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-chart-2 rounded-lg flex items-center justify-center shrink-0">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-foreground sm:text-2xl">Personalized Migraine Monitor and Predictor</h1>
              <p className="text-sm text-muted-foreground">Track. Analyze. Prevent.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button className="w-full sm:w-auto" data-testid="button-connect-wearable" onClick={onConnectWearable}>
              Connect your wearable device
            </Button>
            {onLogout && (
              <Button variant="ghost" size="icon" onClick={onLogout} aria-label={`Sign out${userName ? ` ${userName}` : ""}`} title="Sign out">
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
