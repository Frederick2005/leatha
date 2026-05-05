import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen, GitFork, Heart, MessageSquare, Plus, Sparkles, Trophy, Users, TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { RequireAuth } from "@/components/require-auth";
import { timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Leatha" }],
  }),
  component: () => (<RequireAuth><DashboardPage /></RequireAuth>),
});

interface RecentLesson {
  id: string;
  title: string;
  slug: string;
  like_count: number;
  fork_count: number;
  comment_count: number;
  created_at: string;
}

function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [recent, setRecent] = useState<RecentLesson[]>([]);
  const [trending, setTrending] = useState<RecentLesson[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      supabase
        .from("lessons")
        .select("id, title, slug, like_count, fork_count, comment_count, created_at")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("lessons")
        .select("id, title, slug, like_count, fork_count, comment_count, created_at")
        .eq("is_published", true)
        .order("like_count", { ascending: false })
        .limit(5),
      supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null),
    ]).then(([r1, r2, r3]) => {
      setRecent((r1.data ?? []) as RecentLesson[]);
      setTrending((r2.data ?? []) as RecentLesson[]);
      setUnread(r3.count ?? 0);
      setLoading(false);
    });
  }, [user]);

  if (!user || !profile) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserAvatar name={profile.display_name ?? profile.username} url={profile.avatar_url} size="lg" />
          <div>
            <h1 className="text-2xl font-display font-semibold">
              Welcome back, {profile.display_name ?? profile.username}
            </h1>
            <p className="text-sm text-muted-foreground font-mono">@{profile.username}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild><Link to="/lessons/new"><Plus className="h-4 w-4 mr-1.5" /> New lesson</Link></Button>
          <Button asChild variant="outline"><Link to="/feed"><Sparkles className="h-4 w-4 mr-1.5" /> Feed</Link></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Trophy} label="Points" value={profile.points} accent />
        <StatCard icon={BookOpen} label="Lessons" value={profile.lesson_count} />
        <StatCard icon={GitFork} label="Forks received" value={profile.fork_received_count} />
        <StatCard icon={Users} label="Followers" value={profile.follower_count} />
      </div>

      {/* Unread messages callout */}
      {unread > 0 && (
        <Link
          to="/messages"
          className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-4 hover:bg-primary/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/15 text-primary grid place-items-center">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">{unread} unread message{unread === 1 ? "" : "s"}</div>
              <div className="text-sm text-muted-foreground">Tap to open your inbox</div>
            </div>
          </div>
          <span className="text-primary text-sm font-mono">Open →</span>
        </Link>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* My recent lessons */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display font-semibold">Your recent lessons</h2>
            <Link to="/u/$username" params={{ username: profile.username }} className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {loading ? (
            <SkeletonList />
          ) : recent.length === 0 ? (
            <EmptyState
              title="No lessons yet"
              hint="Start your chain by publishing your first lesson."
              action={<Button size="sm" onClick={() => navigate({ to: "/lessons/new" })}>Create one</Button>}
            />
          ) : (
            <ul className="space-y-2">
              {recent.map((l) => <LessonRow key={l.id} lesson={l} />)}
            </ul>
          )}
        </section>

        {/* Trending */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Trending now
            </h2>
            <Link to="/explore" className="text-xs text-primary hover:underline">Explore more</Link>
          </div>
          {loading ? (
            <SkeletonList />
          ) : trending.length === 0 ? (
            <EmptyState title="Nothing trending yet" hint="Be the first to publish a lesson." />
          ) : (
            <ul className="space-y-2">
              {trending.map((l) => <LessonRow key={l.id} lesson={l} />)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`text-2xl font-display font-bold mt-1 ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function LessonRow({ lesson }: { lesson: RecentLesson }) {
  return (
    <li>
      <Link
        to="/lessons/$lessonId"
        params={{ lessonId: lesson.id }}
        className="block rounded-md border border-border bg-card px-3 py-2.5 hover:border-primary/40 transition-colors"
      >
        <div className="font-medium line-clamp-1">{lesson.title}</div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono mt-1">
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{lesson.like_count}</span>
          <span className="flex items-center gap-1"><GitFork className="h-3 w-3" />{lesson.fork_count}</span>
          <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{lesson.comment_count}</span>
          <span className="ml-auto">{timeAgo(lesson.created_at)}</span>
        </div>
      </Link>
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-14 rounded-md border border-border bg-card animate-pulse" />
      ))}
    </ul>
  );
}

function EmptyState({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border p-6 text-center">
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{hint}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
