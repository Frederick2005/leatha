import { useRef, useState } from "react";
import {
  Paperclip,
  Loader2,
  X,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  File,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { LessonAttachmentMeta } from "@/components/lesson-attachment";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 10;

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const iconFor = (type: string) => {
  if (type.startsWith("image/")) return ImageIcon;
  if (type.startsWith("video/")) return Film;
  if (type.startsWith("audio/")) return Music;
  if (type === "application/pdf") return FileText;
  return File;
};

export function LessonAttachmentUploader({
  userId,
  attachments,
  onChange,
}: {
  userId: string;
  attachments: LessonAttachmentMeta[];
  onChange: (next: LessonAttachmentMeta[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (attachments.length + files.length > MAX_FILES) {
      toast.error(`Max ${MAX_FILES} files per lesson`);
      return;
    }
    setUploading(true);
    const next: LessonAttachmentMeta[] = [...attachments];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 20MB`);
        continue;
      }
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("lesson-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        toast.error(`Failed: ${file.name} — ${error.message}`);
        continue;
      }
      next.push({
        path,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
      });
    }
    onChange(next);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async (path: string) => {
    await supabase.storage.from("lesson-attachments").remove([path]);
    onChange(attachments.filter((a) => a.path !== path));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || attachments.length >= MAX_FILES}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4 mr-1.5" />
        )}
        {uploading ? "Uploading…" : "Attach files"}
      </Button>
      <p className="text-xs text-muted-foreground">
        PDFs, images, docs, video, audio — up to 20MB each, max {MAX_FILES} files.
      </p>
      {attachments.length > 0 && (
        <ul className="space-y-1.5 mt-2">
          {attachments.map((a) => {
            const Icon = iconFor(a.type);
            return (
              <li
                key={a.path}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-surface text-sm"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 truncate">{a.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                <button
                  type="button"
                  onClick={() => void remove(a.path)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
