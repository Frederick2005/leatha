import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

export function RichContent({ content, className }: { content: string; className?: string }) {
  const trimmed = (content ?? "").trim();
  const isHtml = /^<(?:p|div|h[1-6]|ul|ol|blockquote|pre|img|figure|br|span|strong|em|a)\b/i.test(trimmed);

  if (isHtml) {
    return (
      <div
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "prose-headings:font-semibold prose-a:text-primary",
          "prose-code:bg-muted prose-code:rounded prose-code:px-1",
          "prose-pre:bg-muted prose-pre:rounded-lg",
          className
        )}
        dangerouslySetInnerHTML={{ __html: trimmed }}
      />
    );
  }

  return <Markdown className={className}>{content || ""}</Markdown>;
}