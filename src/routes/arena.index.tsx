import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Swords, Trophy, Sparkles, Zap, Shield, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { ChallengeCard, type ChallengeCardData } from "@/components/arena/challenge-card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { rankFor } from "@/lib/arena";

export const Route = createFileRoute("/arena/")({ component: ArenaHome });

interface ArenaProfile {
  xp: number; coins: number; reputation: number; rank: string;
  streak: number; longest_streak: number; shields: number;
  total_solves: number; total_attempts: number; multiplier: number;
}

function ArenaHome() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ArenaProfile | null>(null);
  const [trending, setTrending] = useState<ChallengeCardData[]>([]);
  const [feed, setFeed] = useState<{ id: string; user: string; title: string; ts: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: ap }, { data: ch }, { data: solves }] = await Promise.all([
        supabase.from("arena_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("arena_challenges").select("id,slug,title,description,type,difficulty,tags,estimated_minutes,points_reward,solve_count,attempt_count")
          .eq("status", "published").order("attempt_count", { ascending: false }).limit(6),
        supabase.from("arena_attempts").select("id,created_at,user_id,arena_challenges(title)")
          .eq("status", "passed").order("created_at", { ascending: false }).limit(8),
      ]);
      if (ap) setProfile(ap as ArenaProfile);
      else {
        await supabase.from("arena_profiles").insert({ user_id: user.id });
        setProfile({ xp: 0, coins: 0, reputation: 0, rank: "Bronze", streak: 0, longest_streak: 0, shields: 1, total_solves: 0, total_attempts: 0, multiplier: 1 });
      }
      setTrending((ch ?? []) as ChallengeCardData[]);
      const solveRows = (solves ?? []) as Array<{ id: string; created_at: string; user_id: string; arena_challenges: { title: string } | null }>;
      const userIds = Array.from(new Set(solveRows.map((s) => s.user_id)));
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("id,username").in("id", userIds)
        : { data: [] as { id: string; username: string }[] };
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.username]));
      setFeed(solveRows.map((s) => ({
        id: s.id,
        user: nameMap.get(s.user_id) ?? "someone",
        title: s.arena_challenges?.title ?? "a challenge",
        ts: new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      })));
    })();
  }, [user]);

  const rank = profile ? rankFor(profile.xp) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/20 via-card to-card p-6 md:p-8">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative grid md:grid-cols-[1fr,auto] gap-6 items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" /> Leatha Arena
            </div>
            <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold leading-tight">
              Compete. Master. <span className="text-primary">Become legendary.</span>
            </h1>
            <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-xl">
              Daily challenges, school battles, and a living leaderboard. Solve, earn, and climb the ranks.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild><Link to="/arena/daily"><Flame className="h-4 w-4 mr-1" /> Today's challenge</Link></Button>
              <Button asChild variant="outline"><Link to="/arena/challenges">Browse all</Link></Button>
              <Button asChild variant="ghost"><Link to="/arena/battles"><Swords className="h-4 w-4 mr-1" /> Find a battle</Link></Button>
            </div>
          </div>
          {profile && rank && (
            <div className="rounded-xl bg-card/70 border border-border p-4 min-w-[240px]">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground font-mono uppercase">Your rank</div>
                <div className="text-xs font-mono text-primary">{profile.xp} XP</div>
              </div>
              <div className="mt-1 font-display text-2xl font-bold">{rank.current.rank}</div>
              <Progress value={rank.pct} className="mt-2 h-1.5" />
              <div className="mt-1 text-[11px] text-muted-foreground font-mono">
                {rank.next.rank === rank.current.rank ? "Max rank reached" : `${rank.next.xp - profile.xp} XP to ${rank.next.rank}`}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat icon={<Flame className="h-3 w-3 text-rose-500" />} value={profile.streak} label="streak" />
                <Stat icon={<Shield className="h-3 w-3 text-sky-500" />} value={profile.shields} label="shields" />
                <Stat icon={<Target className="h-3 w-3 text-emerald-500" />} value={profile.total_solves} label="solves" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickCard to="/arena/daily" icon={<Flame className="h-5 w-5 text-rose-500" />} title="Daily" desc="Bonus XP" />
        <QuickCard to="/arena/battles" icon={<Swords className="h-5 w-5 text-primary" />} title="Battle" desc="1v1 live" />
        <QuickCard to="/arena/leaderboard" icon={<Trophy className="h-5 w-5 text-warning" />} title="Leaders" desc="Weekly" />
        <QuickCard to="/arena/profile" icon={<Zap className="h-5 w-5 text-purple-500" />} title="Coins" desc={`${profile?.coins ?? 0} owned`} />
      </div>

      {/* Trending */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-semibold">Trending challenges</h2>
          <Link to="/arena/challenges" className="text-sm text-primary hover:underline">View all →</Link>
        </div>
        {trending.length === 0 ? (
          <EmptyState text="No challenges yet. Teachers — head to Studio and build the first one." cta={{ to: "/arena/studio", label: "Open Studio" }} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {trending.map((c) => <ChallengeCard key={c.id} c={c} />)}
          </div>
        )}
      </section>

      {/* Live activity */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-base font-semibold mb-3 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live solves
        </h2>
        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No solves yet. Be the first.</p>
        ) : (
          <ul className="space-y-2">
            {feed.map((f) => (
              <li key={f.id} className="text-sm flex items-center gap-2 animate-fade-in">
                <span className="text-emerald-500">✓</span>
                <span className="font-mono text-primary">@{f.user}</span>
                <span className="text-muted-foreground">solved</span>
                <span className="font-medium truncate">{f.title}</span>
                <span className="ml-auto text-xs text-muted-foreground font-mono">{f.ts}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1 text-sm font-semibold">{icon}{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}

function QuickCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to} className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow transition-all">
      <div className="flex items-center gap-2">{icon}<span className="font-display font-semibold">{title}</span></div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </Link>
  );
}

function EmptyState({ text, cta }: { text: string; cta?: { to: string; label: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      {cta && <Button asChild className="mt-3"><Link to={cta.to}>{cta.label}</Link></Button>}
    </div>
  );
}
