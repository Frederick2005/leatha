import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { BookOpen, Bookmark, Eye, Flame, Trophy, Sparkles, Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/student")({
  head: () => ({ meta: [{ title: "Student dashboard — Leatha" }] }),
  component: () => (<RequireAuth><StudentDashboard /></RequireAuth>),
});

interface BookmarkRow { lesson_id: string; created_at: string;
  lessons: { id: string; title: string; summary: string | null; view_count: number } | null; }
interface ViewedLesson { id: string; title: string; created_at: string; }
interface ArenaProfile { xp: number; coins: number; rank: string; streak: number; total_solves: number; }

function StudentDashboard() {
  const { user, profile } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [viewed, setViewed] = useState<ViewedLesson[]>([]);
  const [arena, setArena] = useState<ArenaProfile | null>(null);
  const [weeklyLessons, setWeeklyLessons] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    void Promise.all([
      supabase.from("bookmarks")
        .select("lesson_id,created_at,lessons(id,title,summary,view_count)")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("lesson_views")
        .select("lesson_id,created_at,lessons(id,title)")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(15),
      supabase.from("arena_profiles")
        .select("xp,coins,rank,streak,total_solves").eq("user_id", user.id).maybeSingle(),
      supabase.from("lesson_views")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id).gte("created_at", weekAgo),
    ]).then(([b, v, a, w]) => {
      setBookmarks((b.data ?? []) as unknown as BookmarkRow[]);
      const vRows = (v.data ?? []) as unknown as { lesson_id: string; created_at: string; lessons: { id: string; title: string } | null }[];
      const seen = new Set<string>();
      setViewed(vRows
        .filter(r => r.lessons && !seen.has(r.lesson_id) && (seen.add(r.lesson_id), true))
        .map(r => ({ id: r.lessons!.id, title: r.lessons!.title, created_at: r.created_at }))
        .slice(0, 10));
      setArena((a.data as ArenaProfile | null) ?? null);
      setWeeklyLessons(w.count ?? 0);
      setLoading(false);
    });
  }, [user]);

  if (!user || !profile) return null;
  const target = (profile as unknown as { weekly_lesson_target?: number }).weekly_lesson_target ?? 5;
  const pct = Math.min(100, Math.round((weeklyLessons / target) * 100));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Your learning</h1>
        <p className="text-sm text-muted-foreground">Pick up where you left off.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Trophy} label="Points" value={profile.points} accent />
        <Stat icon={Sparkles} label="XP" value={arena?.xp ?? 0} />
        <Stat icon={Flame} label="Streak" value={arena?.streak ?? 0} />
        <Stat icon={Swords} label="Solves" value={arena?.total_solves ?? 0} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Weekly goal</div>
          <span className="text-xs font-mono text-muted-foreground">{weeklyLessons} / {target} lessons</span>
        </div>
        <Progress value={pct} />
        {pct >= 100 && <p className="text-xs text-primary mt-2 font-mono">🔥 Goal hit — keep going!</p>}
      </div>

      <Tabs defaultValue="continue">
        <TabsList>
          <TabsTrigger value="continue">Continue</TabsTrigger>
          <TabsTrigger value="bookmarks">Bookmarks ({bookmarks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="continue" className="mt-4">
          {loading ? <SkeletonList /> : viewed.length === 0 ? (
            <Empty hint="Start exploring lessons to build your learning history." action={
              <Button asChild size="sm"><Link to="/feed"><Sparkles className="h-3.5 w-3.5 mr-1.5" />Open feed</Link></Button>
            } />
          ) : (
            <ul className="space-y-2">
              {viewed.map((l) => (
                <li key={l.id}>
                  <Link to="/lessons/$lessonId" params={{ lessonId: l.id }}
                    className="block rounded-md border border-border bg-card px-3 py-2.5 hover:border-primary/40 transition-colors">
                    <div className="font-medium line-clamp-1">{l.title}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-1"
                      title={format(new Date(l.created_at), "MMM d, yyyy 'at' h:mm a")}>
                      Last opened {timeAgo(l.created_at)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="bookmarks" className="mt-4">
          {bookmarks.length === 0 ? (
            <Empty hint="Bookmark lessons to save them for later." />
          ) : (
            <ul className="space-y-2">
              {bookmarks.filter(b => b.lessons).map((b) => (
                <li key={b.lesson_id}>
                  <Link to="/lessons/$lessonId" params={{ lessonId: b.lessons!.id }}
                    className="block rounded-md border border-border bg-card px-3 py-2.5 hover:border-primary/40 transition-colors">
                    <div className="flex items-center gap-2">
                      <Bookmark className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div className="font-medium line-clamp-1">{b.lessons!.title}</div>
                    </div>
                    {b.lessons!.summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{b.lessons!.summary}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono mt-2">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{b.lessons!.view_count}</span>
                      <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />Saved {timeAgo(b.created_at)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`text-2xl font-display font-bold mt-1 ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
function SkeletonList() {
  return <ul className="space-y-2">{[0,1,2].map(i => <li key={i} className="h-14 rounded-md border border-border bg-card animate-pulse" />)}</ul>;
}
function Empty({ hint, action }: { hint: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border p-6 text-center">
      <div className="text-sm text-muted-foreground">{hint}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
