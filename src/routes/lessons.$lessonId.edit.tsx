import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
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
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/lessons/$lessonId/edit")({
  component: () => (<RequireAuth><EditLessonPage /></RequireAuth>),
});

function EditLessonPage() {
  const { lessonId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [language, setLanguage] = useState("");
  const [attachments, setAttachments] = useState<LessonAttachmentMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    void supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle().then(({ data }) => {
      if (!data) { toast.error("Lesson not found"); navigate({ to: "/" }); return; }
      if (data.author_id !== user.id) { toast.error("Not your lesson"); navigate({ to: "/lessons/$lessonId", params: { lessonId } }); return; }
      setTitle(data.title);
      setSummary(data.summary ?? "");
      setContent(data.content);
      setTagsInput((data.tags ?? []).join(", "));
      setLanguage(data.language ?? "");
      setAttachments(Array.isArray(data.attachments) ? (data.attachments as unknown as LessonAttachmentMeta[]) : []);
      setAllowed(true);
      setReady(true);
    });
  }, [lessonId, user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const tags = tagsInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8);
    const { error } = await supabase.from("lessons").update({
      title: title.trim(),
      summary: summary.trim() || null,
      content,
      tags,
      language: language.trim() || null,
      attachments: attachments as never,
    }).eq("id", lessonId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Lesson updated");
    navigate({ to: "/lessons/$lessonId", params: { lessonId } });
  };

  if (!ready || !allowed) return <div className="h-screen" />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link to="/lessons/$lessonId" params={{ lessonId }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-3 w-3" /> Back to lesson</Link>
      <h1 className="text-2xl font-display font-semibold">Edit lesson</h1>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Summary</Label>
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={280} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Tags</Label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Language</Label>
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Content (Markdown)</Label>
          <Tabs defaultValue="write">
            <TabsList>
              <TabsTrigger value="write"><Pencil className="h-3.5 w-3.5 mr-1.5" /> Write</TabsTrigger>
              <TabsTrigger value="preview"><Eye className="h-3.5 w-3.5 mr-1.5" /> Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="write" className="mt-2">
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[420px] font-mono text-sm" />
            </TabsContent>
            <TabsContent value="preview" className="mt-2">
              <div className="min-h-[420px] rounded-md border border-border bg-surface p-4 overflow-auto">
                <Markdown>{content || "*Nothing to preview.*"}</Markdown>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Attachments</Label>
          <LessonAttachmentUploader userId={user!.id} attachments={attachments} onChange={setAttachments} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/lessons/$lessonId", params: { lessonId } })}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      </form>
    </div>
  );
}
