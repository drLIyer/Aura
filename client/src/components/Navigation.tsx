interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function Navigation({ currentView, onViewChange }: NavigationProps) {
  const tabs = ['dashboard', 'log', 'analytics'];

  return (
    <nav className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {tabs.map((view) => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              data-testid={`button-nav-${view}`}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition ${
                currentView === view
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
