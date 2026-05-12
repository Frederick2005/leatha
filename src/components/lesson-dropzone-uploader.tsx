import { useRef, useState } from "react";
import { UploadCloud, Loader2, X, FileText, FileArchive, File as FileIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LessonAttachmentMeta } from "@/components/lesson-attachment";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_FILES = 10;

const ALLOWED_EXT = ["pdf", "doc", "docx", "zip"];
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip",
]);

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const iconFor = (name: string, type: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "zip" || type.includes("zip")) return FileArchive;
  if (ext === "pdf" || type === "application/pdf") return FileText;
  return FileIcon;
};

const isAllowed = (file: File) => {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXT.includes(ext) || ALLOWED_MIMES.has(file.type);
};

export function LessonDropzoneUploader({
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
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    if (attachments.length + arr.length > MAX_FILES) {
      toast.error(`Max ${MAX_FILES} files per lesson`);
      return;
    }
    setUploading(true);
    const next: LessonAttachmentMeta[] = [...attachments];
    for (const file of arr) {
      if (!isAllowed(file)) {
        toast.error(`${file.name}: only PDF, Word, or ZIP allowed`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 2MB`);
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
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-surface",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <UploadCloud className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm">
          Drag &amp; drop files here, or{" "}
          <Button
            type="button"
            variant="link"
            className="px-0 h-auto"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin inline" /> Uploading…
              </>
            ) : (
              "Browse Files"
            )}
          </Button>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, Word (.doc/.docx), or ZIP — max 2 MB per file
        </p>
        <p className="text-[11px] text-muted-foreground mt-1 italic">
          ZIP files must only contain PDF or Word documents.
        </p>
      </div>

      {attachments.length > 0 && (
        <ul className="space-y-1.5">
          {attachments.map((a) => {
            const Icon = iconFor(a.name, a.type);
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
