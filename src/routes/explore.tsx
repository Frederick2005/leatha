import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { LessonFeedCard } from "@/components/lesson-feed-card";
import { RequireAuth } from "@/components/require-auth";
import { UserAvatar } from "@/components/user-avatar";

const searchSchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
});

export const Route = createFileRoute("/explore")({
  validateSearch: (search) => searchSchema.parse(search),
  component: () => (<RequireAuth><ExplorePage /></RequireAuth>),
});

interface FeedLesson {
  id: string; title: string; slug: string; summary: string | null; tags: string[];
  fork_count: number; like_count: number; comment_count: number; created_at: string;
  parent_lesson_id: string | null;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
}

function ExplorePage() {
  const { q, tag } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(q ?? "");
  const [lessons, setLessons] = useState<FeedLesson[]>([]);
  const [users, setUsers] = useState<{ id: string; username: string; display_name: string | null; avatar_url: string | null; bio: string | null; follower_count: number }[]>([]);
  const [popularTags, setPopularTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setInput(q ?? ""); }, [q]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      let query = supabase
        .from("lessons")
        .select(`id, title, slug, summary, tags, fork_count, like_count, comment_count, created_at, parent_lesson_id,
                 author:profiles!lessons_author_profile_fkey(id, username, display_name, avatar_url)`)
        .eq("is_published", true)
        .limit(50);

      if (tag) query = query.contains("tags", [tag]);
      if (q && q.trim()) {
        const safe = q.trim().replace(/[,()*]/g, " ");
        query = query.or(`title.ilike.%${safe}%,summary.ilike.%${safe}%,tags.cs.{${safe}}`);
      }

      query = query.order("like_count", { ascending: false }).order("created_at", { ascending: false });

      const [{ data: lessonData, error: lessonError }, userResp] = await Promise.all([
        query,
        q && q.trim()
          ? supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url, bio, follower_count")
              .or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`)
              .limit(10)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!cancelled) {
        if (lessonError) console.error("explore query error", lessonError);
        setLessons((lessonData as unknown as FeedLesson[]) ?? []);
        setUsers((userResp.data as typeof users) ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [q, tag]);

  // Debounce live search as user types
  useEffect(() => {
    const t = setTimeout(() => {
      const current = q ?? "";
      if (input !== current) {
        navigate({ to: "/explore", search: (prev: { q?: string; tag?: string }) => ({ ...prev, q: input || undefined }) });
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => {
    let cancelled = false;
    async function loadTags() {
      const { data } = await supabase.from("lessons").select("tags").eq("is_published", true).limit(200);
      if (cancelled) return;
      const counts = new Map<string, number>();
      (data ?? []).forEach((row: { tags: string[] }) => {
        (row.tags ?? []).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
      });
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([tag, count]) => ({ tag, count }));
      setPopularTags(sorted);
    }
    void loadTags();
    return () => { cancelled = true; };
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/explore", search: (prev: { q?: string; tag?: string }) => ({ ...prev, q: input || undefined }) });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-display font-semibold">Explore</h1>
      <p className="text-sm text-muted-foreground">Discover lessons across topics, tags, and forks.</p>

      <form onSubmit={submitSearch} className="mt-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search lessons, tags, or @users…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </form>

      {tag && (
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-muted text-primary text-sm font-mono">
          tag: {tag}
          <Link to="/explore" search={{}} className="opacity-70 hover:opacity-100"><X className="h-3 w-3" /></Link>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_220px] gap-6 mt-6">
        <div className="space-y-3">
          {users.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-xs uppercase font-mono tracking-wider text-muted-foreground mb-3">People</h3>
              <div className="space-y-2">
                {users.map((u) => (
                  <Link
                    key={u.id}
                    to="/u/$username"
                    params={{ username: u.username }}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors"
                  >
                    <UserAvatar name={u.display_name ?? u.username} url={u.avatar_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{u.display_name ?? u.username}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">@{u.username} · {u.follower_count} followers</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {loading ? (
            [1,2,3].map((i) => <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />)
          ) : lessons.length === 0 && users.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
              No lessons or users match your search.
            </div>
          ) : (
            lessons.map((l) => <LessonFeedCard key={l.id} lesson={l} />)
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-lg border border-border bg-card p-4">
            <h3 className="text-xs uppercase font-mono tracking-wider text-muted-foreground mb-3">Popular tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {popularTags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet</p>}
              {popularTags.map((t) => (
                <Link
                  key={t.tag}
                  to="/explore"
                  search={{ tag: t.tag }}
                  className="px-2 py-0.5 rounded bg-muted text-xs font-mono hover:bg-primary-muted hover:text-primary"
                >
                  {t.tag} <span className="opacity-50">{t.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
