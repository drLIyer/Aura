import { useEffect, useState } from "react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient, apiJson } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Dashboard from "@/pages/Dashboard";
import Guidelines from "@/pages/Guidelines";
import Insights from "@/pages/Insights";
import Landing from "@/pages/Landing";
import Log from "@/pages/Log";
import Medications from "@/pages/Medications";
import Patterns from "@/pages/Patterns";
import Profile from "@/pages/Profile";
import Report from "@/pages/Report";
import Wearables from "@/pages/Wearables";
import { todayLocal, userTimeZone } from "@/lib/dates";
import type { ProfileRecord } from "@/lib/types";
import { IS_DEMO } from "@/lib/demo";

export type LogSection = "water" | "meal" | "supplements" | "migraine" | null;
export type View = "dashboard" | "log" | "insights" | "patterns" | "medications" | "profile" | "wearables" | "report" | "guidelines";
const VIEWS: View[] = ["dashboard", "log", "insights", "patterns", "medications", "profile", "wearables", "report", "guidelines"];

function initialView(): View {
  const v = new URLSearchParams(window.location.search).get("view");
  return VIEWS.includes(v as View) ? (v as View) : "dashboard";
}

async function fetchUser(): Promise<{ id: string; firstName?: string | null; lastName?: string | null } | null | "unavailable"> {
  const res = await fetch("/api/auth/user", { credentials: "include" });
  if (res.status === 401) return null;
  if (res.status === 404 || res.status === 503) return "unavailable";
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function Shell() {
  const { data: user, isLoading } = useQuery({ queryKey: ["/api/auth/user"], queryFn: fetchUser, staleTime: 5 * 60_000 });
  const [view, setView] = useState<View>(initialView);
  const [logSection, setLogSection] = useState<LogSection>(null);
  const [date, setDate] = useState(todayLocal());
  const signedIn = Boolean(user && user !== "unavailable");
  const { data: profile } = useQuery<ProfileRecord>({ queryKey: ["/api/profile"], enabled: signedIn });

  // Keep the server's copy of the user's time zone current (used for background jobs and imports).
  useEffect(() => {
    const tz = userTimeZone();
    if (profile && profile.timezone !== tz) void apiJson("/api/profile", "PUT", { timezone: tz }).catch(() => undefined);
  }, [profile]);

  const navigate = (next: View, section: LogSection = null) => {
    setLogSection(section);
    setView(next);
    window.history.replaceState(null, "", next === "dashboard" ? window.location.pathname : `?view=${next}`);
    window.scrollTo({ top: 0 });
  };

  const authName = user && user !== "unavailable" ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "";
  const userName = profile?.profile.name || authName || null;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!signedIn) return <Landing unavailable={user === "unavailable"} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 print:bg-white">
      <div className="print:hidden">
        <Header userName={userName} currentView={view} onNavigate={(v) => navigate(v)} onLogout={IS_DEMO ? undefined : () => (window.location.href = "/api/logout")} />
      </div>
      {IS_DEMO && (
        <div className="bg-primary/10 border-b border-primary/20 text-sm text-center px-4 py-2 print:hidden" data-testid="banner-demo">
          Demo with a fictional patient and 120 days of example data. Everything runs in your browser; changes reset when you reload.
        </div>
      )}
      <Navigation currentView={view} onViewChange={(v) => navigate(v)} />
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {view === "dashboard" && <Dashboard date={date} onDateChange={setDate} onNavigate={navigate} />}
        {view === "log" && <Log date={date} onDateChange={setDate} initialSection={logSection} onSectionHandled={() => setLogSection(null)} onNavigate={navigate} />}
        {(view === "insights" || view === "patterns") && (
          <PatternsSwitch current={view} onChange={(v) => navigate(v)} />
        )}
        {view === "insights" && <Insights date={date} />}
        {view === "patterns" && <Patterns />}
        {view === "medications" && <Medications />}
        {view === "profile" && <Profile />}
        {view === "wearables" && <Wearables date={date} />}
        {view === "report" && <Report date={date} />}
        {view === "guidelines" && <Guidelines />}
      </main>
    </div>
  );
}

/** "My patterns" has two halves: what the logs show, and what the patient has noticed themselves. */
function PatternsSwitch({ current, onChange }: { current: View; onChange: (v: View) => void }) {
  const options: { view: View; label: string }[] = [
    { view: "insights", label: "What your data shows" },
    { view: "patterns", label: "What you've noticed" },
  ];
  return (
    <div className="mb-6 flex justify-center print:hidden">
      <div className="inline-flex rounded-lg bg-muted p-1" role="tablist">
        {options.map((o) => (
          <button
            key={o.view}
            role="tab"
            aria-selected={current === o.view}
            onClick={() => onChange(o.view)}
            data-testid={`tab-${o.view}`}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              current === o.view ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Shell />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
