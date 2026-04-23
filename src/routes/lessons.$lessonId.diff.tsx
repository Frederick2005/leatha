import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { diffLines } from "diff";
import { ArrowLeft, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/lessons/$lessonId/diff")({
  component: DiffPage,
});

interface LessonLite {
  id: string; title: string; content: string;
  parent_lesson_id: string | null;
  author: { username: string } | null;
}

function DiffPage() {
  const { lessonId } = Route.useParams();
  const [child, setChild] = useState<LessonLite | null>(null);
  const [parent, setParent] = useState<LessonLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: c } = await supabase.from("lessons")
        .select("id, title, content, parent_lesson_id, author:profiles!lessons_author_id_fkey(username)")
        .eq("id", lessonId).maybeSingle();
      if (!c || cancelled) { setLoading(false); return; }
      setChild(c as unknown as LessonLite);
      if (c.parent_lesson_id) {
        const { data: p } = await supabase.from("lessons")
          .select("id, title, content, parent_lesson_id, author:profiles!lessons_author_id_fkey(username)")
          .eq("id", c.parent_lesson_id).maybeSingle();
        if (!cancelled) setParent(p as unknown as LessonLite ?? null);
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [lessonId]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-10"><div className="h-64 rounded-lg bg-muted animate-pulse" /></div>;
  if (!child) return <div className="p-10 text-center text-muted-foreground">Lesson not found.</div>;
  if (!parent) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-muted-foreground">This lesson is original — no fork diff to show.</p>
        <Link to="/lessons/$lessonId" params={{ lessonId }} className="text-primary hover:underline">Back to lesson</Link>
      </div>
    );
  }

  const diff = diffLines(parent.content, child.content);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link to="/lessons/$lessonId" params={{ lessonId }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-3 w-3" /> Back to lesson</Link>
      <h1 className="text-2xl font-display font-semibold flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" /> Diff</h1>
      <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-2">
        <Link to="/lessons/$lessonId" params={{ lessonId: parent.id }} className="px-2 py-0.5 rounded bg-muted font-mono text-xs hover:text-primary">
          {parent.title} {parent.author && `· @${parent.author.username}`}
        </Link>
        <span>→</span>
        <span className="px-2 py-0.5 rounded bg-primary-muted text-primary font-mono text-xs">{child.title}</span>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface font-mono text-xs overflow-x-auto">
        <pre className="p-4 leading-relaxed">
          {diff.map((part, i) => {
            const cls = part.added ? "diff-add" : part.removed ? "diff-del" : "";
            const prefix = part.added ? "+ " : part.removed ? "- " : "  ";
            return (
              <span key={i} className={cls + " block whitespace-pre-wrap"}>
                {part.value.split("\n").filter((_, idx, arr) => idx < arr.length - 1 || arr[idx] !== "").map((line, li) => (
                  <span key={li} className="block">{prefix}{line}</span>
                ))}
              </span>
            );
          })}
        </pre>
      </div>
    </div>
  );
}
