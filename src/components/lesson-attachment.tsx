import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Image as ImageIcon, Film, Music, File } from "lucide-react";

export interface LessonAttachmentMeta {
  path: string;
  name: string;
  size: number;
  type: string;
}

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

export function publicUrlFor(path: string) {
  return supabase.storage.from("lesson-attachments").getPublicUrl(path).data.publicUrl;
}

export function LessonAttachment({ att }: { att: LessonAttachmentMeta }) {
  const url = publicUrlFor(att.path);
  const isImage = att.type.startsWith("image/");

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={att.name}
          className="max-w-full max-h-80 rounded-lg border border-border object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  const Icon = iconFor(att.type);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={att.name}
      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface hover:border-primary/40 hover:bg-accent transition-colors max-w-md"
    >
      <Icon className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{att.name}</div>
        <div className="text-xs text-muted-foreground">{formatBytes(att.size)}</div>
      </div>
      <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
    </a>
  );
}
