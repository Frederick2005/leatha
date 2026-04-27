import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Eye, Pencil, GitFork } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Markdown } from "@/components/markdown";
import { LessonAttachmentUploader } from "@/components/lesson-attachment-uploader";
import type { LessonAttachmentMeta } from "@/components/lesson-attachment";
import { slugify } from "@/lib/utils";

export const Route = createFileRoute("/lessons/new")({
  validateSearch: (s) => z.object({ fork: z.string().uuid().optional() }).parse(s),
  component: NewLessonPage,
});

function NewLessonPage() {
  const { fork } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [language, setLanguage] = useState("");
  const [attachments, setAttachments] = useState<LessonAttachmentMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [parentTitle, setParentTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!fork) return;
    void supabase.from("lessons").select("title, summary, content, tags, language, attachments").eq("id", fork).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setTitle(`${data.title} (fork)`);
        setSummary(data.summary ?? "");
        setContent(data.content);
        setTagsInput((data.tags ?? []).join(", "));
        setLanguage(data.language ?? "");
        setParentTitle(data.title);
        // Don't copy attachments on fork — fork starts clean (user uploads their own)
      });
  }, [fork]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (title.trim().length < 3) { toast.error("Title too short"); return; }
    if (content.trim().length < 10) { toast.error("Content too short"); return; }
    setBusy(true);
    const tags = tagsInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8);
    const slug = slugify(title);
    const { data, error } = await supabase.from("lessons").insert({
      author_id: user.id,
      title: title.trim(),
      slug,
      summary: summary.trim() || null,
      content,
      tags,
      language: language.trim() || null,
      parent_lesson_id: fork ?? null,
      is_published: true,
      attachments: attachments as never,
    }).select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(fork ? "Forked & published — +10 points!" : "Lesson published — +10 points!");
    navigate({ to: "/lessons/$lessonId", params: { lessonId: data.id } });
  };

  if (loading || !user) return <div className="h-screen" />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-3 w-3" /> Cancel</Link>
      <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
        {fork ? <><GitFork className="h-5 w-5 text-primary" /> Fork lesson</> : "New lesson"}
      </h1>
      {parentTitle && <p className="text-sm text-muted-foreground">Forking <span className="font-medium text-foreground">{parentTitle}</span></p>}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="A clear, specific title…" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Summary (optional)</Label>
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={280} placeholder="One-sentence pitch…" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Tags (comma-separated, max 8)</Label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="javascript, hooks, react" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Language / topic</Label>
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="TypeScript" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Content (Markdown)</Label>
          <Tabs defaultValue="write">
            <TabsList>
              <TabsTrigger value="write"><Pencil className="h-3.5 w-3.5 mr-1.5" /> Write</TabsTrigger>
              <TabsTrigger value="preview"><Eye className="h-3.5 w-3.5 mr-1.5" /> Preview</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
            </TabsList>
            <TabsContent value="write" className="mt-2">
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[420px] font-mono text-sm" placeholder="# Hello\n\nWrite your lesson here in **Markdown**." />
            </TabsContent>
            <TabsContent value="preview" className="mt-2">
              <div className="min-h-[420px] rounded-md border border-border bg-surface p-4 overflow-auto">
                <Markdown>{content || "*Nothing to preview.*"}</Markdown>
              </div>
            </TabsContent>
            <TabsContent value="split" className="mt-2">
              <div className="grid md:grid-cols-2 gap-3">
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[420px] font-mono text-sm" />
                <div className="min-h-[420px] rounded-md border border-border bg-surface p-4 overflow-auto">
                  <Markdown>{content || "*Nothing to preview.*"}</Markdown>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Attachments (optional)</Label>
          <LessonAttachmentUploader userId={user.id} attachments={attachments} onChange={setAttachments} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/" })}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Publishing…" : fork ? "Publish fork" : "Publish lesson"}</Button>
        </div>
      </form>
    </div>
  );
}
