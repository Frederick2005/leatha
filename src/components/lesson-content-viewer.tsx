import { useEffect, useState } from "react";
import { RichContent } from "@/components/rich-content";
import { FileText, Download } from "lucide-react";

export type ContentType = "text" | "video" | "document";

function youtubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function inferDocType(url: string): string {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "doc";
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "ppt";
  if (lower.endsWith(".txt")) return "txt";
  return "other";
}

interface Props {
  contentType: ContentType;
  content: string;
  videoUrl?: string | null;
  documentUrl?: string | null;
  documentType?: string | null;
}

export function LessonContentViewer({
  contentType,
  content,
  videoUrl,
  documentUrl,
  documentType,
}: Props) {
  const [txtBody, setTxtBody] = useState<string | null>(null);
  const docType = documentUrl ? documentType || inferDocType(documentUrl) : null;

  useEffect(() => {
    if (contentType === "document" && docType === "txt" && documentUrl) {
      fetch(documentUrl)
        .then((r) => r.text())
        .then(setTxtBody)
        .catch(() => setTxtBody("Failed to load text file."));
    }
  }, [contentType, docType, documentUrl]);

  if (contentType === "video" && videoUrl) {
    const id = youtubeId(videoUrl);
    if (!id) {
      return (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          Invalid YouTube URL. Please paste a valid youtube.com or youtu.be link.
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="aspect-video w-full rounded-lg overflow-hidden border border-border bg-black">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${id}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {content && <RichContent content={content} />}
      </div>
    );
  }

  if (contentType === "document" && documentUrl) {
    return (
      <div className="space-y-4">
        {docType === "pdf" && (
          <iframe
            src={documentUrl}
            className="w-full h-[80vh] rounded-lg border border-border bg-white"
            title="PDF"
          />
        )}
        {(docType === "doc" || docType === "ppt") && (
          <iframe
            src={`https://docs.google.com/gview?url=${encodeURIComponent(documentUrl)}&embedded=true`}
            className="w-full h-[80vh] rounded-lg border border-border bg-white"
            title="Document"
          />
        )}
        {docType === "txt" && (
          <pre className="whitespace-pre-wrap text-sm bg-muted/40 rounded-lg p-4 border border-border max-h-[80vh] overflow-auto">
            {txtBody ?? "Loading…"}
          </pre>
        )}
        {docType === "other" && (
          <div className="rounded-md border border-border p-4 flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm flex-1 truncate">{documentUrl}</span>
            <a
              href={documentUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary text-sm inline-flex items-center gap-1"
            >
              <Download className="h-4 w-4" /> Open
            </a>
          </div>
        )}
        {content && <RichContent content={content} />}
      </div>
    );
  }

  return <RichContent content={content || "*No content yet.*"} />;
}
