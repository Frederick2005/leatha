import { Link, useLocation } from "@tanstack/react-router";
import { Swords, Trophy, Flame, Layers, GraduationCap, BarChart3, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/arena",             label: "Home",        icon: Sparkles,     exact: true },
  { to: "/arena/challenges",  label: "Challenges",  icon: Layers },
  { to: "/arena/daily",       label: "Daily",       icon: Flame },
  { to: "/arena/battles",     label: "Battles",     icon: Swords },
  { to: "/arena/leaderboard", label: "Leaders",     icon: Trophy },
  { to: "/arena/studio",      label: "Studio",      icon: GraduationCap },
  { to: "/arena/schools",     label: "Schools",     icon: BarChart3 },
  { to: "/arena/profile",     label: "Profile",     icon: User },
] as const;

export function ArenaNav() {
  const loc = useLocation();
  return (
    <div className="border-b border-border bg-card/40 backdrop-blur sticky top-14 z-20">
      <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto scrollbar-none">
        {tabs.map((t) => {
          const active = t.exact ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
