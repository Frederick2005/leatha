import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowUp, Eye, Clock, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/suggestions/$id")({
  component: () => (<RequireAuth><SuggestionDetail /></RequireAuth>),
});

interface FullSuggestion {
  id: string; title: string; description: string; subject: string;
  upvote_count: number; view_count: number; status: string;
  claimed_by: string | null; lesson_id: string | null; created_at: string;
  suggested_by: string;
  suggester?: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
  claimer?: { username: string } | null;
}

function SuggestionDetail() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const [s, setS] = useState<FullSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [upvoters, setUpvoters] = useState<{ username: string; avatar_url: string | null; display_name: string | null }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("lesson_suggestions")
        .select(`*,
          suggester:profiles!lesson_suggestions_suggested_by_fkey(id,username,display_name,avatar_url),
          claimer:profiles!lesson_suggestions_claimed_by_fkey(username)`)
        .eq("id", id).maybeSingle();
      setS(data as unknown as FullSuggestion);
      if (user && data) {
        await supabase.from("suggestion_views").upsert({ suggestion_id: id, user_id: user.id }, { onConflict: "suggestion_id,user_id", ignoreDuplicates: true });
        void trackEvent("suggestion_view", { suggestion_id: id, subject: (data as { subject: string }).subject });
        const { data: up } = await supabase.from("suggestion_upvotes").select("user_id").eq("suggestion_id", id).eq("user_id", user.id).maybeSingle();
        setHasUpvoted(!!up);
      }
      const { data: ups } = await supabase
        .from("suggestion_upvotes")
        .select("user:profiles!suggestion_upvotes_user_id_fkey(username,avatar_url,display_name)")
        .eq("suggestion_id", id).limit(50);
      setUpvoters(((ups ?? []) as unknown as { user: { username: string; avatar_url: string | null; display_name: string | null } }[]).map((r) => r.user).filter(Boolean));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  const toggleUpvote = async () => {
    if (!user || !s) return;
    if (hasUpvoted) {
      await supabase.from("suggestion_upvotes").delete().eq("suggestion_id", s.id).eq("user_id", user.id);
      setHasUpvoted(false);
      setS({ ...s, upvote_count: Math.max(0, s.upvote_count - 1) });
    } else {
      const { error } = await supabase.from("suggestion_upvotes").insert({ suggestion_id: s.id, user_id: user.id });
      if (error) { toast.error("Couldn't upvote"); return; }
      setHasUpvoted(true);
      setS({ ...s, upvote_count: s.upvote_count + 1 });
      void trackEvent("suggestion_upvote", { suggestion_id: s.id, subject: s.subject });
    }
  };

  const claim = async () => {
    if (!user || !s) return;
    const { error } = await supabase.from("lesson_suggestions").update({
      claimed_by: user.id, claimed_at: new Date().toISOString(), status: "in_progress",
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Claimed — when you publish a lesson, link it here.");
    setS({ ...s, claimed_by: user.id, status: "in_progress" });
  };

  if (loading) return <div className="max-w-3xl mx-auto p-6 space-y-3"><Skeleton className="h-40" /></div>;
  if (!s) return <div className="p-10 text-center text-muted-foreground">Suggestion not found.</div>;

  const exact = format(new Date(s.created_at), "MMM d, yyyy 'at' h:mm a");
  const isTeacher = profile?.account_type === "teacher";
  const canClaim = isTeacher && s.status === "open";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link to="/suggestions" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> All suggestions
      </Link>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-1">
            <Button size="sm" variant={hasUpvoted ? "default" : "outline"} className="h-12 w-12 p-0" onClick={toggleUpvote}>
              <ArrowUp className="h-5 w-5" />
            </Button>
            <span className="font-mono font-bold">{s.upvote_count}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant="secondary">{s.subject}</Badge>
              <Badge variant={s.status === "completed" ? "default" : s.status === "in_progress" ? "secondary" : "outline"}>
                {s.status.replace("_", " ")}
              </Badge>
            </div>
            <h1 className="text-2xl font-display font-bold">{s.title}</h1>
            <p className="text-sm whitespace-pre-wrap mt-3 text-foreground/90">{s.description}</p>

            <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground font-mono">
              {s.suggester && (
                <Link to="/u/$username" params={{ username: s.suggester.username }} className="inline-flex items-center gap-1.5 hover:text-primary">
                  <UserAvatar size="sm" name={s.suggester.display_name ?? s.suggester.username} url={s.suggester.avatar_url} />
                  @{s.suggester.username}
                </Link>
              )}
              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {s.view_count} views</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {timeAgo(s.created_at)} · {exact}</span>
            </div>

            {s.status === "in_progress" && s.claimer && (
              <p className="text-sm text-primary mt-4">Teacher @{s.claimer.username} is working on this.</p>
            )}
            {s.status === "completed" && s.lesson_id && (
              <Button asChild className="mt-4">
                <Link to="/lessons/$lessonId" params={{ lessonId: s.lesson_id }}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> View published lesson
                </Link>
              </Button>
            )}
            {canClaim && (
              <Button onClick={claim} className="mt-4">Claim this suggestion</Button>
            )}
          </div>
        </div>
      </div>

      {upvoters.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold mb-2">Upvoters ({upvoters.length})</h2>
          <div className="flex flex-wrap gap-2">
            {upvoters.map((u) => (
              <Link key={u.username} to="/u/$username" params={{ username: u.username }} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted hover:bg-accent text-xs">
                <UserAvatar size="sm" name={u.display_name ?? u.username} url={u.avatar_url} />
                @{u.username}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
