import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Crown, Medal, Flame, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/arena/leaderboard")({ component: ArenaLeaderboard });

interface Row {
  user_id: string; xp: number; rank: string; streak: number; total_solves: number;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

function ArenaLeaderboard() {
  const [scope, setScope] = useState<"students" | "schools">("students");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void supabase
      .from("arena_profiles")
      .select("user_id,xp,rank,streak,total_solves,profiles(username,display_name,avatar_url)")
      .order("xp", { ascending: false })
      .limit(50)
      .then(({ data }) => { setRows((data ?? []) as unknown as Row[]); setLoading(false); });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Trophy className="h-6 w-6 text-warning" /> Arena Leaderboard</h1>
          <p className="text-sm text-muted-foreground">Top contenders this season.</p>
        </div>
        <div className="flex gap-1 rounded-md border border-border p-1">
          {(["students", "schools"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)}
              className={cn("px-3 py-1 text-xs rounded capitalize", scope === s ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>{s}</button>
          ))}
        </div>
      </header>

      {scope === "schools" ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          School rankings open once seasonal scoring runs.
        </div>
      ) : loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {rows.map((r, i) => (
            <Link key={r.user_id} to="/u/$username" params={{ username: r.profiles?.username ?? "" }}
              className="flex items-center gap-3 p-3 hover:bg-accent transition-colors">
              <div className="w-8 text-center">
                {i === 0 ? <Crown className="h-5 w-5 text-warning mx-auto" /> :
                 i === 1 ? <Medal className="h-5 w-5 text-muted-foreground mx-auto" /> :
                 i === 2 ? <Medal className="h-5 w-5 text-warning/70 mx-auto" /> :
                 <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>}
              </div>
              <UserAvatar name={r.profiles?.display_name ?? r.profiles?.username} url={r.profiles?.avatar_url ?? null} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.profiles?.display_name ?? r.profiles?.username ?? "—"}</p>
                <p className="text-xs font-mono text-muted-foreground">@{r.profiles?.username} · {r.rank}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-primary">{r.xp} XP</div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-end gap-2">
                  <span className="flex items-center gap-0.5"><Flame className="h-3 w-3 text-rose-500" />{r.streak}</span>
                  <span className="flex items-center gap-0.5"><Shield className="h-3 w-3 text-sky-500" />{r.total_solves}</span>
                </div>
              </div>
            </Link>
          ))}
          {rows.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No arena activity yet.</div>}
        </div>
      )}
    </div>
  );
}
