import type { View } from "../App";

const TABS: { view: View; label: string }[] = [
  { view: "dashboard", label: "Today" },
  { view: "log", label: "Log" },
  { view: "insights", label: "Insights" },
  { view: "patterns", label: "My patterns" },
  { view: "medications", label: "Medicines" },
  { view: "profile", label: "Profile" },
  { view: "wearables", label: "Wearables" },
  { view: "report", label: "Doctor report" },
  { view: "guidelines", label: "Guidelines" },
];

export default function Navigation({ currentView, onViewChange }: { currentView: View; onViewChange: (view: View) => void }) {
  return (
    <nav className="bg-card border-b border-border print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6 overflow-x-auto">
          {TABS.map(({ view, label }) => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              data-testid={`button-nav-${view}`}
              aria-current={currentView === view ? "page" : undefined}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition ${
                currentView === view ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
