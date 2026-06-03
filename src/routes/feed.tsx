import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GitFork, Heart, MessageCircle, Sparkles, TrendingUp, Users, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import { RequireAuth } from "@/components/require-auth";
import { timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/feed")({
  component: FeedRoute,
});

interface FeedLesson {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  tags: string[];
  fork_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  parent_lesson_id: string | null;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

function FeedRoute() {
  return (
    <RequireAuth>
      <FeedPage />
    </RequireAuth>
  );
}

function FeedPage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<"trending" | "following" | "new">("trending");
  const [lessons, setLessons] = useState<FeedLesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      let query = supabase
        .from("lessons")
        .select(
          `id, title, slug, summary, tags, fork_count, like_count, comment_count, created_at, parent_lesson_id,
                 author:profiles!lessons_author_profile_fkey(id, username, display_name, avatar_url)`,
        )
        .eq("is_published", true)
        .limit(30);

      if (tab === "trending") {
        query = query
          .order("like_count", { ascending: false })
          .order("fork_count", { ascending: false })
          .order("created_at", { ascending: false });
      } else if (tab === "new") {
        query = query.order("created_at", { ascending: false });
      } else if (tab === "following" && user) {
        const { data: followingData } = await supabase
          .from("follows")
          .select("followee_id")
          .eq("follower_id", user.id);
        const ids = (followingData ?? []).map((f) => f.followee_id);
        if (ids.length === 0) {
          if (!cancelled) {
            setLessons([]);
            setLoading(false);
          }
          return;
        }
        query = query.in("author_id", ids).order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (!cancelled) {
        if (error) console.error(error);
        setLessons((data as unknown as FeedLesson[]) ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tab, user]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold">Welcome back, {profile?.username}</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.points ?? 0} points · {profile?.lesson_count ?? 0} lessons ·{" "}
            {profile?.follower_count ?? 0} followers
          </p>
        </div>
        {profile?.account_type === "teacher" && (
          <Button asChild>
            <Link to="/lessons/new">New lesson</Link>
          </Button>
        )}
        {profile?.account_type === "student" && (
          <Button asChild>
            <Link to="/suggestions/new"><Lightbulb className="h-4 w-4 mr-2" /> Suggest</Link>
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="following">
            <Users className="h-3.5 w-3.5 mr-1.5" /> Following
          </TabsTrigger>
          <TabsTrigger value="trending">
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Trending
          </TabsTrigger>
          <TabsTrigger value="new">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> New
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="space-y-3 mt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : lessons.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            lessons.map((l) => <LessonFeedCard key={l.id} lesson={l} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ tab }: { tab: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <p className="text-muted-foreground">
        {tab === "following"
          ? "Follow some authors to populate your feed."
          : "Nothing here yet. Be the first."}
      </p>
      <Button asChild className="mt-4" variant="outline">
        <Link to="/explore">Explore lessons</Link>
      </Button>
    </div>
  );
}

function LessonFeedCard({ lesson }: { lesson: FeedLesson }) {
  return (
    <article className="rounded-lg border border-border bg-card hover:border-primary/40 transition-colors p-5">
      <div className="flex items-start gap-3">
        <UserAvatar
          name={lesson.author?.display_name ?? lesson.author?.username}
          url={lesson.author?.avatar_url}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {lesson.author && (
              <Link
                to="/u/$username"
                params={{ username: lesson.author.username }}
                className="font-medium text-foreground hover:text-primary"
              >
                @{lesson.author.username}
              </Link>
            )}
            <span>·</span>
            <span>{timeAgo(lesson.created_at)}</span>
            {lesson.parent_lesson_id && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary-muted text-primary font-mono text-[10px]">
                <GitFork className="h-2.5 w-2.5" /> FORK
              </span>
            )}
          </div>
          <Link to="/lessons/$lessonId" params={{ lessonId: lesson.id }} className="block mt-1">
            <h3 className="font-semibold text-lg leading-snug hover:text-primary transition-colors">
              {lesson.title}
            </h3>
          </Link>
          {lesson.summary && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{lesson.summary}</p>
          )}
          {lesson.tags.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {lesson.tags.slice(0, 5).map((t) => (
                <Link
                  key={t}
                  to="/explore"
                  search={{ tag: t }}
                  className="px-2 py-0.5 rounded bg-muted text-xs font-mono text-muted-foreground hover:text-primary"
                >
                  {t}
                </Link>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 font-mono">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> {lesson.like_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <GitFork className="h-3.5 w-3.5" /> {lesson.fork_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" /> {lesson.comment_count}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
