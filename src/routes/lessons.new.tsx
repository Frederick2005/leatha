import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft, Eye, Pencil, GitFork,
  Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, Code, Link as LinkIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Markdown } from "@/components/markdown";
import { LessonDropzoneUploader } from "@/components/lesson-dropzone-uploader";
import type { LessonAttachmentMeta } from "@/components/lesson-attachment";
import { slugify } from "@/lib/utils";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/lessons/new")({
  validateSearch: (s) => z.object({ fork: z.string().uuid().optional() }).parse(s),
  component: () => (<RequireAuth><NewLessonPage /></RequireAuth>),
});

const DEFAULT_CATEGORIES = [
  "Mathematics", "Physics", "Chemistry", "Biology",
  "English", "History", "Geography",
  "Programming", "Design", "Business",
];

function NewLessonPage() {
  const { fork } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [attachments, setAttachments] = useState<LessonAttachmentMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [parentTitle, setParentTitle] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        const lang = data.language ?? "";
        if (lang && DEFAULT_CATEGORIES.includes(lang)) {
          setCategory(lang);
        } else if (lang) {
          setCategory("__other");
          setCustomCategory(lang);
        }
        setParentTitle(data.title);
      });
  }, [fork]);

  const wrap = (before: string, after = before, placeholder = "text") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end) || placeholder;
    const next = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + before.length + selected.length;
      ta.setSelectionRange(cursor, cursor);
    });
  };

  const prefixLine = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const next = content.slice(0, lineStart) + prefix + content.slice(lineStart);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + prefix.length;
      ta.setSelectionRange(cursor, cursor);
    });
  };

  const insertLink = () => {
    const url = window.prompt("Enter URL");
    if (!url) return;
    wrap("[", `](${url})`, "link text");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (title.trim().length < 3) { toast.error("Title too short"); return; }
    if (content.trim().length < 10) { toast.error("Content too short"); return; }
    const finalCategory = category === "__other" ? customCategory.trim() : category.trim();
    if (!finalCategory) { toast.error("Please select or enter a category"); return; }
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
      language: finalCategory,
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
        {fork ? <><GitFork className="h-5 w-5 text-primary" /> Fork lesson</> : "Create New Lesson"}
      </h1>
      {parentTitle && <p className="text-sm text-muted-foreground">Forking <span className="font-medium text-foreground">{parentTitle}</span></p>}

      <form onSubmit={submit} className="mt-6 space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Lesson Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="A clear, specific title…" />
        </div>

        {/* Summary */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Summary (optional)</Label>
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={280} placeholder="One-sentence pitch…" />
        </div>

        {/* Category + Tags */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <SelectItem value="__other">Other (add your own)…</SelectItem>
              </SelectContent>
            </Select>
            {category === "__other" && (
              <Input
                className="mt-2"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Type your category"
                maxLength={40}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Tags (comma-separated, max 8)</Label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="javascript, hooks, react" />
          </div>
        </div>

        {/* Content with toolbar */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">Lesson Content</Label>
          <Tabs defaultValue="write">
            <TabsList>
              <TabsTrigger value="write"><Pencil className="h-3.5 w-3.5 mr-1.5" /> Write</TabsTrigger>
              <TabsTrigger value="preview"><Eye className="h-3.5 w-3.5 mr-1.5" /> Preview</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
            </TabsList>
            <TabsContent value="write" className="mt-2">
              <EditorToolbar wrap={wrap} prefixLine={prefixLine} insertLink={insertLink} />
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[420px] font-mono text-sm rounded-t-none"
                placeholder="Write your lesson here in Markdown. Use the toolbar above for formatting."
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-2">
              <div className="min-h-[420px] rounded-md border border-border bg-surface p-4 overflow-auto">
                <Markdown>{content || "*Nothing to preview.*"}</Markdown>
              </div>
            </TabsContent>
            <TabsContent value="split" className="mt-2">
              <EditorToolbar wrap={wrap} prefixLine={prefixLine} insertLink={insertLink} />
              <div className="grid md:grid-cols-2 gap-3">
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[420px] font-mono text-sm rounded-t-none"
                />
                <div className="min-h-[420px] rounded-md border border-border bg-surface p-4 overflow-auto">
                  <Markdown>{content || "*Nothing to preview.*"}</Markdown>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Attachments */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
            Attachments <span className="text-muted-foreground/70 normal-case">(optional)</span>
          </Label>
          <LessonDropzoneUploader userId={user.id} attachments={attachments} onChange={setAttachments} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/" })}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Publishing…" : fork ? "Publish fork" : "Create Lesson"}</Button>
        </div>
      </form>
    </div>
  );
}

function EditorToolbar({
  wrap,
  prefixLine,
  insertLink,
}: {
  wrap: (b: string, a?: string, p?: string) => void;
  prefixLine: (p: string) => void;
  insertLink: () => void;
}) {
  const btn = "p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors";
  return (
    <div className="flex flex-wrap items-center gap-0.5 border border-border border-b-0 rounded-t-md bg-surface px-2 py-1">
      <button type="button" className={btn} onClick={() => prefixLine("# ")} title="Heading 1"><Heading1 className="h-4 w-4" /></button>
      <button type="button" className={btn} onClick={() => prefixLine("## ")} title="Heading 2"><Heading2 className="h-4 w-4" /></button>
      <span className="w-px h-4 bg-border mx-1" />
      <button type="button" className={btn} onClick={() => wrap("**")} title="Bold"><Bold className="h-4 w-4" /></button>
      <button type="button" className={btn} onClick={() => wrap("*")} title="Italic"><Italic className="h-4 w-4" /></button>
      <button type="button" className={btn} onClick={() => wrap("`")} title="Inline code"><Code className="h-4 w-4" /></button>
      <span className="w-px h-4 bg-border mx-1" />
      <button type="button" className={btn} onClick={() => prefixLine("- ")} title="Bulleted list"><List className="h-4 w-4" /></button>
      <button type="button" className={btn} onClick={() => prefixLine("1. ")} title="Numbered list"><ListOrdered className="h-4 w-4" /></button>
      <button type="button" className={btn} onClick={() => prefixLine("> ")} title="Quote"><Quote className="h-4 w-4" /></button>
      <span className="w-px h-4 bg-border mx-1" />
      <button type="button" className={btn} onClick={insertLink} title="Link"><LinkIcon className="h-4 w-4" /></button>
    </div>
  );
}
