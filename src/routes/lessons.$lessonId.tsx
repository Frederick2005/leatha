import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GitFork, Heart, MessageCircle, Edit2, Trash2, Flag, ArrowLeft, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Markdown } from "@/components/markdown";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/lessons/$lessonId")({
  component: LessonPage,
});

interface LessonRow {
  id: string; title: string; slug: string; summary: string | null; content: string;
  tags: string[]; language: string | null; parent_lesson_id: string | null; root_lesson_id: string | null;
  fork_count: number; like_count: number; comment_count: number; is_published: boolean;
  author_id: string; created_at: string; updated_at: string;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
  parent: { id: string; title: string; author: { username: string } | null } | null;
}

interface CommentRow {
  id: string; body: string; created_at: string; author_id: string;
  author: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

function LessonPage() {
  const { lessonId } = Route.useParams();
  const { user, isModOrAdmin } = useAuth();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [forks, setForks] = useState<{ id: string; title: string; author: { username: string } | null }[]>([]);
  const [contributors, setContributors] = useState<{ user_id: string; profile: { username: string; display_name: string | null; avatar_url: string | null } | null }[]>([]);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState("");
  const [reportReason, setReportReason] = useState("");

  const reload = async () => {
    const { data, error } = await supabase
      .from("lessons")
      .select(`*,
        author:profiles!lessons_author_id_fkey(id, username, display_name, avatar_url),
        parent:lessons!lessons_parent_lesson_id_fkey(id, title, author:profiles!lessons_author_id_fkey(username))`)
      .eq("id", lessonId)
      .maybeSingle();
    if (error || !data) { setLesson(null); setLoading(false); return; }
    setLesson(data as unknown as LessonRow);

    const [{ data: cs }, { data: fs }, { data: contribs }] = await Promise.all([
      supabase.from("comments").select(`id, body, created_at, author_id,
        author:profiles!comments_author_id_fkey(username, display_name, avatar_url)`)
        .eq("lesson_id", lessonId).order("created_at", { ascending: true }),
      supabase.from("lessons").select(`id, title, author:profiles!lessons_author_id_fkey(username)`)
        .eq("parent_lesson_id", lessonId).limit(20),
      supabase.from("lesson_contributors").select(`user_id, profile:profiles!lesson_contributors_user_id_fkey(username, display_name, avatar_url)`)
        .eq("lesson_id", lessonId),
    ]);
    setComments((cs as unknown as CommentRow[]) ?? []);
    setForks((fs as unknown as typeof forks) ?? []);
    setContributors((contribs as unknown as typeof contributors) ?? []);

    if (user) {
      const { data: like } = await supabase.from("lesson_likes").select("user_id").eq("user_id", user.id).eq("lesson_id", lessonId).maybeSingle();
      setLiked(!!like);
    }
    setLoading(false);
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lessonId, user?.id]);

  const toggleLike = async () => {
    if (!user) { toast.error("Sign in to like"); return; }
    if (!lesson) return;
    if (liked) {
      await supabase.from("lesson_likes").delete().eq("user_id", user.id).eq("lesson_id", lesson.id);
      setLiked(false);
      setLesson({ ...lesson, like_count: Math.max(0, lesson.like_count - 1) });
    } else {
      await supabase.from("lesson_likes").insert({ user_id: user.id, lesson_id: lesson.id });
      setLiked(true);
      setLesson({ ...lesson, like_count: lesson.like_count + 1 });
    }
  };

  const handleFork = async () => {
    if (!user) { toast.error("Sign in to fork"); return; }
    if (!lesson) return;
    navigate({ to: "/lessons/new", search: { fork: lesson.id } });
  };

  const handleDelete = async () => {
    if (!lesson) return;
    const { error } = await supabase.from("lessons").delete().eq("id", lesson.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lesson deleted");
    navigate({ to: "/" });
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Sign in to comment"); return; }
    if (!commentBody.trim()) return;
    const { error } = await supabase.from("comments").insert({
      lesson_id: lessonId, author_id: user.id, body: commentBody.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setCommentBody("");
    toast.success("Comment posted");
    void reload();
  };

  const submitReport = async () => {
    if (!user || !lesson) return;
    if (!reportReason.trim()) { toast.error("Reason required"); return; }
    const { error } = await supabase.from("reports").insert({
      reported_by: user.id, target_type: "lesson", target_id: lesson.id, reason: reportReason.trim(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Report submitted to moderators");
    setReportReason("");
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-10"><div className="h-64 rounded-lg bg-muted animate-pulse" /></div>;
  }
  if (!lesson) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-muted-foreground">Lesson not found.</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/">Back to feed</Link></Button>
      </div>
    );
  }

  const isOwner = user?.id === lesson.author_id;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_240px] gap-6">
      <article className="min-w-0">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-3 w-3" /> Back</Link>

        {lesson.parent && (
          <div className="rounded-md border border-primary-muted bg-primary-muted/30 px-3 py-2 text-xs mb-3 inline-flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-primary" />
            Forked from{" "}
            <Link to="/lessons/$lessonId" params={{ lessonId: lesson.parent.id }} className="font-medium text-primary hover:underline">
              {lesson.parent.title}
            </Link>
            {lesson.parent.author && <span className="text-muted-foreground">by @{lesson.parent.author.username}</span>}
            {" — "}
            <Link to="/lessons/$lessonId/diff" params={{ lessonId: lesson.id }} className="text-primary hover:underline">view diff</Link>
          </div>
        )}

        <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">{lesson.title}</h1>
        {lesson.summary && <p className="text-lg text-muted-foreground mt-2">{lesson.summary}</p>}

        <div className="flex flex-wrap items-center gap-3 mt-4 text-sm">
          {lesson.author && (
            <Link to="/u/$username" params={{ username: lesson.author.username }} className="flex items-center gap-2 hover:text-primary">
              <UserAvatar name={lesson.author.display_name ?? lesson.author.username} url={lesson.author.avatar_url} size="sm" />
              <span className="font-medium">@{lesson.author.username}</span>
            </Link>
          )}
          <span className="text-muted-foreground">· {timeAgo(lesson.created_at)}</span>
          {lesson.language && <span className="px-2 py-0.5 rounded bg-muted text-xs font-mono text-muted-foreground">{lesson.language}</span>}
        </div>

        {lesson.tags.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {lesson.tags.map((t) => (
              <Link key={t} to="/explore" search={{ tag: t }} className="px-2 py-0.5 rounded bg-muted text-xs font-mono hover:bg-primary-muted hover:text-primary">{t}</Link>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-5 flex-wrap">
          <Button onClick={toggleLike} variant={liked ? "default" : "outline"} size="sm">
            <Heart className={`h-4 w-4 mr-1.5 ${liked ? "fill-current" : ""}`} /> {lesson.like_count}
          </Button>
          <Button onClick={handleFork} variant="outline" size="sm">
            <GitFork className="h-4 w-4 mr-1.5" /> Fork ({lesson.fork_count})
          </Button>
          {isOwner && (
            <Button asChild variant="outline" size="sm">
              <Link to="/lessons/$lessonId/edit" params={{ lessonId: lesson.id }}><Edit2 className="h-4 w-4 mr-1.5" /> Edit</Link>
            </Button>
          )}
          {(isOwner || isModOrAdmin) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this lesson?</AlertDialogTitle>
                  <AlertDialogDescription>This cannot be undone. All forks remain but will lose their parent link.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!isOwner && user && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground"><Flag className="h-4 w-4 mr-1.5" /> Report</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report lesson</DialogTitle>
                  <DialogDescription>Tell moderators what's wrong. Be specific.</DialogDescription>
                </DialogHeader>
                <Textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="Spam, harmful content, plagiarism…" />
                <Button onClick={submitReport}>Submit report</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="mt-8 border-t border-border pt-8">
          <Markdown>{lesson.content || "*No content yet.*"}</Markdown>
        </div>

        {/* Comments */}
        <div className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-display font-semibold flex items-center gap-2"><MessageCircle className="h-5 w-5" /> Discussion ({comments.length})</h2>
          {user ? (
            <form onSubmit={submitComment} className="mt-4 space-y-2">
              <Textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add to the discussion…" maxLength={5000} />
              <div className="flex justify-end"><Button type="submit" disabled={!commentBody.trim()}>Post comment</Button></div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground mt-3"><Link to="/auth" className="text-primary hover:underline">Sign in</Link> to comment.</p>
          )}
          <div className="mt-6 space-y-4">
            {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <UserAvatar name={c.author?.display_name ?? c.author?.username} url={c.author?.avatar_url} size="sm" />
                <div className="flex-1 rounded-md bg-surface border border-border p-3">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">@{c.author?.username ?? "user"}</span> · {timeAgo(c.created_at)}
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>

      <aside className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4 sticky top-20">
          <h3 className="text-xs uppercase font-mono tracking-wider text-muted-foreground mb-3">Contributors ({contributors.length})</h3>
          <div className="flex -space-x-2">
            {contributors.slice(0, 8).map((c) => (
              <UserAvatar key={c.user_id} name={c.profile?.display_name ?? c.profile?.username} url={c.profile?.avatar_url} size="sm" />
            ))}
          </div>
          {forks.length > 0 && (
            <>
              <h3 className="text-xs uppercase font-mono tracking-wider text-muted-foreground mt-5 mb-2">Forks ({forks.length})</h3>
              <ul className="space-y-1.5 text-sm">
                {forks.slice(0, 6).map((f) => (
                  <li key={f.id}>
                    <Link to="/lessons/$lessonId" params={{ lessonId: f.id }} className="hover:text-primary line-clamp-1">
                      {f.title}
                    </Link>
                    {f.author && <span className="text-xs text-muted-foreground">@{f.author.username}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
