import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/arena/daily")({ component: DailyPage });

interface Daily { for_date: string; bonus_points: number; arena_challenges: { slug: string; title: string; description: string; difficulty: string } | null }

function DailyPage() {
  const [daily, setDaily] = useState<Daily | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    void supabase
      .from("arena_daily_challenges")
      .select("for_date, bonus_points, arena_challenges(slug,title,description,difficulty)")
      .eq("for_date", today)
      .maybeSingle()
      .then(({ data }) => { setDaily(data as unknown as Daily | null); setLoading(false); });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-rose-500/20 via-card to-card p-8 text-center relative overflow-hidden">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-rose-500/20 blur-3xl" />
        <Flame className="h-12 w-12 mx-auto text-rose-500" />
        <div className="mt-2 text-xs uppercase font-mono tracking-widest text-rose-500">Daily Challenge</div>
        <h1 className="font-display text-3xl font-bold mt-1">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h1>
        {loading ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p> : !daily?.arena_challenges ? (
          <>
            <p className="mt-4 text-sm text-muted-foreground">No daily challenge featured today.</p>
            <Button asChild className="mt-4"><Link to="/arena/challenges">Browse all challenges</Link></Button>
          </>
        ) : (
          <>
            <p className="mt-4 font-display text-xl font-semibold">{daily.arena_challenges.title}</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto line-clamp-3">{daily.arena_challenges.description}</p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              <Star className="h-4 w-4 text-warning" /> +{daily.bonus_points} bonus XP
            </div>
            <Button asChild size="lg" className="mt-5">
              <Link to="/arena/challenges/$slug" params={{ slug: daily.arena_challenges.slug }}>Start now</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
