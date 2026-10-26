import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Dashboard from "@/pages/Dashboard";
import Log from "@/pages/Log";
import Analytics from "@/pages/Analytics";

export type LogSection = 'water' | 'meal' | 'supplements' | 'migraine' | null;

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [logSection, setLogSection] = useState<LogSection>(null);

  const handleNavigateToLog = (section: LogSection) => {
    setLogSection(section);
    setCurrentView('log');
  };

  const handleViewChange = (view: string) => {
    setLogSection(null);
    setCurrentView(view);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
          <Header />
          <Navigation currentView={currentView} onViewChange={handleViewChange} />
          
          <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            {currentView === 'dashboard' && <Dashboard onNavigateToLog={handleNavigateToLog} />}
            {currentView === 'log' && <Log initialSection={logSection} onSectionHandled={() => setLogSection(null)} />}
            {currentView === 'analytics' && <Analytics />}
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
