import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

/**
 * Renders lesson content. New lessons use HTML (Quill);
 * older lessons may be stored as Markdown. We detect HTML by
 * checking for an HTML tag signature at the start of the trimmed content.
 */
export function RichContent({ content, className }: { content: string; className?: string }) {
  const trimmed = (content ?? "").trim();
  const isHtml = /^<(?:p|div|h[1-6]|ul|ol|blockquote|pre|img|figure|br|span|strong|em|a)\b/i.test(
    trimmed,
  );

  if (isHtml) {
    return (
      <div
        className={cn("ql-snow", className)}
        // Quill content rendered verbatim — produced by the app's trusted editor.
      >
        <div
          className="ql-editor"
          style={{ padding: 0 }}
          dangerouslySetInnerHTML={{ __html: trimmed }}
        />
      </div>
    );
  }

  return <Markdown className={className}>{content || ""}</Markdown>;
}
