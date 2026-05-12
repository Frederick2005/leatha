import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, GitFork } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichEditor } from "@/components/rich-editor";
import { LessonDropzoneUploader } from "@/components/lesson-dropzone-uploader";
import type { LessonAttachmentMeta } from "@/components/lesson-attachment";
import { slugify } from "@/lib/utils";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/lessons/new")({
  validateSearch: (s) => z.object({ fork: z.string().uuid().optional() }).parse(s),
  component: () => (
    <RequireAuth>
      <NewLessonPage />
    </RequireAuth>
  ),
});

const DEFAULT_CATEGORIES = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "History",
  "Geography",
  "Programming",
  "Design",
  "Business",
];

// Strip HTML tags to measure real text length
const textLen = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim().length;

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
  const [contentType, setContentType] = useState<"text" | "video" | "document">("text");
  const [videoUrl, setVideoUrl] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentType, setDocumentType] = useState("pdf");
  const [busy, setBusy] = useState(false);
  const [parentTitle, setParentTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!fork) return;
    void supabase
      .from("lessons")
      .select("title, summary, content, tags, language, attachments")
      .eq("id", fork)
      .maybeSingle()
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (title.trim().length < 3) {
      toast.error("Title too short");
      return;
    }
    if (contentType === "text" && textLen(content) < 10) {
      toast.error("Content too short");
      return;
    }
    if (contentType === "video" && !videoUrl.trim()) {
      toast.error("Add a YouTube link");
      return;
    }
    if (contentType === "document" && !documentUrl.trim()) {
      toast.error("Add a document URL");
      return;
    }
    const finalCategory = category === "__other" ? customCategory.trim() : category.trim();
    if (!finalCategory) {
      toast.error("Please select or enter a category");
      return;
    }
    setBusy(true);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
    const slug = slugify(title);
    const { data, error } = await supabase
      .from("lessons")
      .insert({
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
        content_type: contentType,
        video_url: contentType === "video" ? videoUrl.trim() : null,
        document_url: contentType === "document" ? documentUrl.trim() : null,
        document_type: contentType === "document" ? documentType : null,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void import("@/lib/analytics").then((m) =>
      m.trackEvent(fork ? "lesson_forked" : "lesson_created", { lesson_id: data.id }),
    );
    toast.success(fork ? "Forked & published — +10 points!" : "Lesson published — +10 points!");
    navigate({ to: "/lessons/$lessonId", params: { lessonId: data.id } });
  };

  if (loading || !user) return <div className="h-screen" />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link
        to="/dashboard"
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="h-3 w-3" /> Cancel
      </Link>
      <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
        {fork ? (
          <>
            <GitFork className="h-5 w-5 text-primary" /> Fork lesson
          </>
        ) : (
          "Create New Lesson"
        )}
      </h1>
      {parentTitle && (
        <p className="text-sm text-muted-foreground">
          Forking <span className="font-medium text-foreground">{parentTitle}</span>
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
            Lesson Title
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="A clear, specific title…"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
            Summary (optional)
          </Label>
          <Input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={280}
            placeholder="One-sentence pitch…"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
              Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
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
            <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
              Tags (comma-separated, max 8)
            </Label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="javascript, hooks, react"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
            Content Type
          </Label>
          <Select
            value={contentType}
            onValueChange={(v) => setContentType(v as "text" | "video" | "document")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text / Article</SelectItem>
              <SelectItem value="video">YouTube Video</SelectItem>
              <SelectItem value="document">Document (PDF/DOC/PPT/TXT)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {contentType === "video" && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
              YouTube URL
            </Label>
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </div>
        )}

        {contentType === "document" && (
          <div className="grid sm:grid-cols-[1fr_180px] gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
                Document URL
              </Label>
              <Input
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                placeholder="https://…/file.pdf"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
                Type
              </Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="doc">DOC/DOCX</SelectItem>
                  <SelectItem value="ppt">PPT/PPTX</SelectItem>
                  <SelectItem value="txt">TXT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
            {contentType === "text" ? "Lesson Content" : "Description / Notes (optional)"}
          </Label>
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="Write your lesson here. Use the toolbar to format text, add lists, links, and more."
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
            Attachments <span className="text-muted-foreground/70 normal-case">(optional)</span>
          </Label>
          <LessonDropzoneUploader
            userId={user.id}
            attachments={attachments}
            onChange={setAttachments}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Publishing…" : fork ? "Publish fork" : "Create Lesson"}
          </Button>
        </div>
      </form>
    </div>
  );
}
