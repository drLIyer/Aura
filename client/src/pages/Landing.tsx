import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Landing({ unavailable }: { unavailable?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="w-14 h-14 mx-auto bg-gradient-to-br from-primary to-chart-2 rounded-xl flex items-center justify-center">
          <Brain className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold">Personalized Migraine Monitor and Predictor</h1>
        <p className="text-muted-foreground">Track your migraines, learn your own triggers, and bring a clear, guideline-based summary to your doctor.</p>
        {unavailable ? (
          <p className="text-sm text-destructive">Sign-in isn't configured on this server yet.</p>
        ) : (
          <Button size="lg" className="w-full" asChild>
            <a href="/api/login" data-testid="button-login">
              Sign in
            </a>
          </Button>
        )}
        <p className="text-xs text-muted-foreground">Your health data is private to your account.</p>
      </Card>
    </div>
  );
}
