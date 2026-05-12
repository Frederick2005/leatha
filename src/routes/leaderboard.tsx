import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Crown, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/user-avatar";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/leaderboard")({
  component: () => (
    <RequireAuth>
      <LeaderboardPage />
    </RequireAuth>
  ),
});

interface Row {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  points: number;
  lesson_count: number;
  fork_received_count: number;
}

function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, points, lesson_count, fork_received_count")
      .order("points", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3">
        <Trophy className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-display font-semibold">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">Top contributors by points earned.</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 h-64 rounded-lg bg-muted animate-pulse" />
      ) : (
        <div className="mt-6 rounded-lg border border-border bg-card divide-y divide-border">
          {rows.map((r, i) => (
            <Link
              key={r.id}
              to="/u/$username"
              params={{ username: r.username }}
              className="flex items-center gap-3 p-3 hover:bg-accent transition-colors"
            >
              <div className="w-8 text-center font-mono text-sm">
                {i === 0 ? (
                  <Crown className="h-5 w-5 text-warning mx-auto" />
                ) : i === 1 ? (
                  <Medal className="h-5 w-5 text-muted-foreground mx-auto" />
                ) : i === 2 ? (
                  <Medal className="h-5 w-5 text-warning/70 mx-auto" />
                ) : (
                  <span className="text-muted-foreground">{i + 1}</span>
                )}
              </div>
              <UserAvatar name={r.display_name ?? r.username} url={r.avatar_url} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.display_name ?? r.username}</p>
                <p className="text-xs font-mono text-muted-foreground truncate">@{r.username}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">{r.points} pts</p>
                <p className="text-xs text-muted-foreground">
                  {r.lesson_count}L · {r.fork_received_count}F
                </p>
              </div>
            </Link>
          ))}
          {rows.length === 0 && (
            <div className="p-10 text-center text-muted-foreground text-sm">No users yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
