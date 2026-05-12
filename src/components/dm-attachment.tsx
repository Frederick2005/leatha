import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Image as ImageIcon, Film, Music, File } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AttachmentMeta {
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

export function DmAttachment({ att, mine }: { att: AttachmentMeta; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = att.type.startsWith("image/");
  const isAudio = att.type.startsWith("audio/");
  const isVideo = att.type.startsWith("video/");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Voice notes & media are uploaded to the public chat-media bucket
      const { data } = supabase.storage.from("chat-media").getPublicUrl(att.path);
      if (!cancelled) setUrl(data?.publicUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [att.path]);

  if (isAudio && url) {
    return (
      <div
        className={cn(
          "rounded-2xl px-3 py-2 max-w-[280px]",
          mine ? "bg-primary-foreground/10" : "bg-background border border-border",
        )}
      >
        <audio controls src={url} className="w-full h-10" preload="metadata" />
        <div className="text-[10px] opacity-60 mt-1">Voice note · {formatBytes(att.size)}</div>
      </div>
    );
  }

  if (isImage && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={att.name}
          className="max-w-full max-h-64 rounded-lg border border-border/50 object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  if (isVideo && url) {
    return (
      <video
        controls
        src={url}
        className="max-w-full max-h-64 rounded-lg border border-border/50"
        preload="metadata"
      />
    );
  }

  const Icon = iconFor(att.type);
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      download={att.name}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border max-w-xs",
        mine
          ? "bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20"
          : "bg-background border-border hover:bg-accent",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{att.name}</div>
        <div className="text-[10px] opacity-70">{formatBytes(att.size)}</div>
      </div>
      <Download className="h-3.5 w-3.5 shrink-0 opacity-60" />
    </a>
  );
}
