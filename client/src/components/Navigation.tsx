import type { View } from "../App";

/** Main tabs. Profile, medicines and wearables live in the account menu (top right). */
const TABS: { view: View; label: string; also?: View[] }[] = [
  { view: "dashboard", label: "Today" },
  { view: "log", label: "Log" },
  { view: "insights", label: "My patterns", also: ["patterns"] },
  { view: "report", label: "Doctor report" },
  { view: "guidelines", label: "Guidelines" },
];

export default function Navigation({ currentView, onViewChange }: { currentView: View; onViewChange: (view: View) => void }) {
  return (
    <nav className="bg-card border-b border-border print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6 overflow-x-auto">
          {TABS.map(({ view, label, also }) => {
            const active = currentView === view || Boolean(also?.includes(currentView));
            return (
              <button
                key={view}
                onClick={() => onViewChange(view)}
                data-testid={`button-nav-${view}`}
                aria-current={active ? "page" : undefined}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition ${
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
