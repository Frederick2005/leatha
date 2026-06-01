import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Shield, Star, Trophy, Zap, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Progress } from "@/components/ui/progress";
import { rankFor } from "@/lib/arena";

export const Route = createFileRoute("/arena/profile")({ component: ArenaProfilePage });

interface AP { xp:number; coins:number; reputation:number; rank:string; streak:number; longest_streak:number; shields:number; total_solves:number; total_attempts:number; multiplier:number; last_active:string|null }
interface Attempt { id: string; created_at: string; status: string; score: number; arena_challenges: { title: string; slug: string } | null }
interface Title { id: string; title: string; description: string | null; earned_at: string }

function ArenaProfilePage() {
  const { user, profile } = useAuth();
  const [ap, setAp] = useState<AP | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: a }, { data: at }, { data: tt }] = await Promise.all([
        supabase.from("arena_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("arena_attempts").select("id,created_at,status,score,arena_challenges(title,slug)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("arena_titles").select("*").eq("user_id", user.id),
      ]);
      setAp(a as AP | null);
      setAttempts((at ?? []) as unknown as Attempt[]);
      setTitles((tt ?? []) as Title[]);
    })();
  }, [user]);

  if (!ap) return <div className="max-w-3xl mx-auto px-4 py-10 text-center text-muted-foreground">Loading…</div>;
  const r = rankFor(ap.xp);
  const solveRate = ap.total_attempts > 0 ? Math.round((ap.total_solves / ap.total_attempts) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase font-mono text-muted-foreground">Arena identity</div>
            <h1 className="font-display text-3xl font-bold mt-1">{profile?.display_name ?? profile?.username}</h1>
            <p className="text-sm text-muted-foreground font-mono">@{profile?.username}</p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30">
              <Trophy className="h-4 w-4 text-warning" />
              <span className="font-display font-semibold">{r.current.rank}</span>
              <span className="text-xs text-muted-foreground font-mono">· {ap.xp} XP</span>
            </div>
            <div className="mt-3 max-w-sm">
              <Progress value={r.pct} className="h-2" />
              <div className="text-[11px] text-muted-foreground font-mono mt-1">
                {r.next.rank === r.current.rank ? "Max rank" : `${r.next.xp - ap.xp} XP to ${r.next.rank}`}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 min-w-[260px]">
            <Tile icon={<Flame className="h-4 w-4 text-rose-500" />} value={ap.streak} label="streak" />
            <Tile icon={<Shield className="h-4 w-4 text-sky-500" />} value={ap.shields} label="shields" />
            <Tile icon={<Zap className="h-4 w-4 text-amber-500" />} value={ap.coins} label="coins" />
            <Tile icon={<Star className="h-4 w-4 text-warning" />} value={ap.total_solves} label="solves" />
            <Tile icon={<Award className="h-4 w-4 text-purple-500" />} value={ap.reputation} label="rep" />
            <Tile icon={<Flame className="h-4 w-4 text-emerald-500" />} value={`${solveRate}%`} label="acc" />
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold mb-2">Titles earned</h2>
        {titles.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground text-center">Earn titles by mastering specific challenge categories.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {titles.map((t) => (
              <div key={t.id} className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-xs font-mono">{t.title}</div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold mb-2">Recent attempts</h2>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {attempts.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No attempts yet.</div>
          ) : attempts.map((a) => (
            <div key={a.id} className="p-3 flex items-center gap-3 text-sm">
              <span className={a.status === "passed" ? "text-emerald-500" : a.status === "failed" ? "text-rose-500" : "text-muted-foreground"}>
                {a.status === "passed" ? "✓" : a.status === "failed" ? "✗" : "…"}
              </span>
              <span className="flex-1 truncate">{a.arena_challenges?.title ?? "—"}</span>
              <span className="font-mono text-xs text-primary">+{a.score} XP</span>
              <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Tile({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="rounded-lg bg-card/60 border border-border px-3 py-2 text-center">
      <div className="flex items-center gap-1 justify-center text-sm font-semibold">{icon}{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}
