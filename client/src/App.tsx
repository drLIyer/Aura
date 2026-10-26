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

export type LogSection = "water" | "meal" | "supplements" | "migraine" | null;
export type View = "dashboard" | "log" | "insights" | "patterns" | "medications" | "profile" | "wearables" | "report" | "guidelines";
const VIEWS: View[] = ["dashboard", "log", "insights", "patterns", "medications", "profile", "wearables", "report", "guidelines"];

function initialView(): View {
  const v = new URLSearchParams(window.location.search).get("view");
  return VIEWS.includes(v as View) ? (v as View) : "dashboard";
}

async function fetchUser(): Promise<{ id: string; firstName?: string | null } | null | "unavailable"> {
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
    window.history.replaceState(null, "", next === "dashboard" ? "/" : `/?view=${next}`);
    window.scrollTo({ top: 0 });
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!signedIn) return <Landing unavailable={user === "unavailable"} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 print:bg-white">
      <div className="print:hidden">
        <Header onConnectWearable={() => navigate("wearables")} onLogout={() => (window.location.href = "/api/logout")} />
      </div>
      <Navigation currentView={view} onViewChange={(v) => navigate(v)} />
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {view === "dashboard" && <Dashboard date={date} onDateChange={setDate} onNavigate={navigate} />}
        {view === "log" && <Log date={date} onDateChange={setDate} initialSection={logSection} onSectionHandled={() => setLogSection(null)} onNavigate={navigate} />}
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
