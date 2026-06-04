import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  GitFork, Home, BookOpen, MessageSquare, MessagesSquare, Trophy, Sparkles, Swords, Lightbulb,
  Shield, User as UserIcon, LogIn, LogOut, Plus, Search, Moon, Sun, Palette, Menu, X, MessageSquareWarning,
  GraduationCap, Backpack,
} from "lucide-react";
import { LeathaLogo } from "@/components/leatha-logo";
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { ThemePicker } from "@/components/theme-picker";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";

const navItems = [
  { to: "/dashboard" as const, label: "Dashboard", icon: Home, auth: true },
  { to: "/feed" as const, label: "Feed", icon: Sparkles, auth: true },
  { to: "/explore" as const, label: "Explore", icon: BookOpen, auth: true },
  { to: "/arena" as const, label: "Arena", icon: Swords, auth: true, highlight: true },
  { to: "/suggestions" as const, label: "Suggestions", icon: Lightbulb, auth: true },
  { to: "/chat" as const, label: "Chat", icon: MessageSquare, auth: true },
  { to: "/messages" as const, label: "Messages", icon: MessagesSquare, auth: true },
  { to: "/leaderboard" as const, label: "Leaderboard", icon: Trophy, auth: true },
];

export function AppShell() {
  const { user, profile, isModOrAdmin, signOut, loading } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchQuery(params.get("q") ?? "");
  }, [location.search]);

  // Redirect new/incomplete users to onboarding
  useEffect(() => {
    if (loading || !user || !profile) return;
    const p = profile as unknown as { has_completed_onboarding?: boolean; account_type?: string; school?: string | null; username?: string };
    const needsOnboarding =
      !p.has_completed_onboarding ||
      !p.username ||
      !p.account_type ||
      !p.school;
    if (!needsOnboarding) return;
    const skip = ["/onboarding", "/auth", "/reset-password", "/terms", "/privacy", "/cookies", "/legal"];
    if (skip.some((s) => location.pathname.startsWith(s))) return;
    navigate({ to: "/onboarding", replace: true });
  }, [loading, user, profile, location.pathname, navigate]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate({ to: "/explore", search: { q: searchQuery || undefined } });
  };

  const handleSignOut = async () => {
    await signOut();
    // Replace history so back-button cannot return to a protected page
    navigate({ to: "/", replace: true });
    // Hard-clear forward history by replacing current entry again
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-sidebar text-sidebar-foreground sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center gap-2">
          <LeathaLogo size={32} />
          <div className="font-display font-semibold text-lg tracking-tight">Leatha</div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            if (item.auth && !user) return null;
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {profile?.account_type === "teacher" && (
            <Link to="/teacher" className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              location.pathname.startsWith("/teacher") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60")}>
              <GraduationCap className="h-4 w-4" /> Teacher
            </Link>
          )}
          {profile?.account_type === "student" && (
            <Link to="/student" className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              location.pathname.startsWith("/student") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60")}>
              <Backpack className="h-4 w-4" /> My learning
            </Link>
          )}
          {isModOrAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                location.pathname.startsWith("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
              )}
            >
              <Shield className="h-4 w-4" />
              Moderation
            </Link>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          {user ? (
            <Button asChild className="w-full justify-start gap-2" variant="default">
              <Link to="/lessons/new"><Plus className="h-4 w-4" /> New lesson</Link>
            </Button>
          ) : (
            <Button asChild className="w-full justify-start gap-2" variant="default">
              <Link to="/auth"><LogIn className="h-4 w-4" /> Sign in</Link>
            </Button>
          )}
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setThemeOpen(true)}
              className="p-2 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
              aria-label="Pick theme"
            >
              <Palette className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-3 space-y-1">
            <div className="flex items-center justify-between px-2 py-2">
              <div className="font-display font-semibold">Leatha</div>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            {navItems.map((item) => {
              if (item.auth && !user) return null;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
                >
                  <Icon className="h-4 w-4" /> {item.label}
                </Link>
              );
            })}
            {profile?.account_type === "teacher" && (
              <Link to="/teacher" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
                <GraduationCap className="h-4 w-4" /> Teacher
              </Link>
            )}
            {profile?.account_type === "student" && (
              <Link to="/student" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
                <Backpack className="h-4 w-4" /> My learning
              </Link>
            )}
            {isModOrAdmin && (
              <Link to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
                <Shield className="h-4 w-4" /> Moderation
              </Link>
            )}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur flex items-center px-4 gap-3">
          <button className="lg:hidden p-2 -ml-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="lg:hidden flex items-center gap-2 font-display font-semibold">
            <LeathaLogo size={28} />
            Leatha
          </Link>
          <div className="flex-1 max-w-md hidden sm:block">
            {location.pathname !== "/" ? (
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search lessons, tags, users…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search lessons, tags, and users"
                />
              </form>
            ) : null}
          </div>
          <div className="flex-1 sm:hidden" />

          {!loading && (user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full hover:bg-accent p-1 pr-3">
                  <UserAvatar name={profile?.display_name ?? profile?.username} url={profile?.avatar_url} size="sm" />
                  <span className="text-sm font-medium hidden sm:inline">{profile?.username ?? "..."}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="text-sm font-semibold">{profile?.display_name ?? profile?.username}</span>
                  <span className="text-xs text-muted-foreground font-mono">@{profile?.username}</span>
                  <span className="text-xs text-primary mt-1">{profile?.points ?? 0} pts</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/u/$username" params={{ username: profile?.username ?? "" }}>
                    <UserIcon className="h-4 w-4 mr-2" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/lessons/new"><Plus className="h-4 w-4 mr-2" /> New lesson</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/feedback"><MessageSquareWarning className="h-4 w-4 mr-2" /> Send feedback</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setThemeOpen(true)}>
                  <Palette className="h-4 w-4 mr-2" /> Themes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleDarkMode}>
                  {darkMode ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                  {darkMode ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={toggleDarkMode} className="p-2 rounded-md hover:bg-accent" aria-label="Toggle dark mode">
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>
            </div>
          ))}
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>

        <footer className="border-t border-border bg-background/80">
          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <LeathaLogo size={16} />
              <span className="font-semibold text-foreground">Leatha</span>
              <span>© 2026{new Date().getFullYear() > 2026 ? `–${new Date().getFullYear()}` : ""} — All rights reserved.</span>
            </div>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link to="/feedback" className="hover:text-primary">Feedback</Link>
              <Link to="/terms" className="hover:text-primary">Terms</Link>
              <Link to="/privacy" className="hover:text-primary">Privacy</Link>
              <Link to="/cookies" className="hover:text-primary">Cookies</Link>
              <Link to="/legal" className="hover:text-primary">Legal</Link>
            </nav>
          </div>
        </footer>
      </div>

      <ThemePicker open={themeOpen} onOpenChange={setThemeOpen} />
      <Toaster richColors closeButton position="top-right" />
    </div>
  );
}
