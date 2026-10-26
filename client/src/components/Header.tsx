import { Brain, LogOut, Pill, UserRound, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { View } from "../App";

interface HeaderProps {
  userName?: string | null;
  currentView: View;
  onNavigate: (view: View) => void;
  onLogout?: () => void;
}

/** "Priya Sharma" → "PS"; "priya" → "P"; nothing → null. */
export function initials(name?: string | null): string | null {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const letters = parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

const ACCOUNT_ITEMS: { view: View; label: string; icon: typeof Pill }[] = [
  { view: "profile", label: "Health profile", icon: UserRound },
  { view: "medications", label: "Medicines & supplements", icon: Pill },
  { view: "wearables", label: "Wearables", icon: Watch },
];

export default function Header({ userName, currentView, onNavigate, onLogout }: HeaderProps) {
  const short = initials(userName);
  return (
    <header className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-chart-2 rounded-lg flex items-center justify-center shrink-0">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">Aura</h1>
              <p className="text-sm text-muted-foreground">Personalized migraine monitor and predictor</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button className="hidden sm:inline-flex" data-testid="button-connect-wearable" onClick={() => onNavigate("wearables")}>
              Connect your wearable device
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`Account menu${userName ? ` for ${userName}` : ""}`}
                  data-testid="button-user-menu"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{short ?? <UserRound className="w-5 h-5" />}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{userName || "Your account"}</div>
                  {!userName && <div className="text-xs text-muted-foreground">Add your name in Health profile</div>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ACCOUNT_ITEMS.map(({ view, label, icon: Icon }) => (
                  <DropdownMenuItem
                    key={view}
                    onSelect={() => onNavigate(view)}
                    className={currentView === view ? "bg-accent" : undefined}
                    data-testid={`menu-${view}`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {label}
                  </DropdownMenuItem>
                ))}
                {onLogout && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onLogout} data-testid="menu-logout">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
