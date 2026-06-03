import { Link } from "@tanstack/react-router";
import { Eye, GitFork, Heart, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { UserAvatar } from "@/components/user-avatar";
import { timeAgo } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface FeedLesson {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  tags: string[];
  fork_count: number;
  like_count: number;
  comment_count: number;
  view_count?: number;
  created_at: string;
  parent_lesson_id: string | null;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
}

export function LessonFeedCard({ lesson }: { lesson: FeedLesson }) {
  const exact = format(new Date(lesson.created_at), "MMM d, yyyy 'at' h:mm a");
  return (
    <article className="rounded-lg border border-border bg-card hover:border-primary/40 transition-colors p-5">
      <div className="flex items-start gap-3">
        <UserAvatar
          name={lesson.author?.display_name ?? lesson.author?.username}
          url={lesson.author?.avatar_url}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {lesson.author && (
              <Link to="/u/$username" params={{ username: lesson.author.username }} className="font-medium text-foreground hover:text-primary">
                @{lesson.author.username}
              </Link>
            )}
            <span>·</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild><span className="cursor-default">{timeAgo(lesson.created_at)}</span></TooltipTrigger>
                <TooltipContent>{exact}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {lesson.parent_lesson_id && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary-muted text-primary font-mono text-[10px]">
                <GitFork className="h-2.5 w-2.5" /> FORK
              </span>
            )}
          </div>
          <Link to="/lessons/$lessonId" params={{ lessonId: lesson.id }} className="block mt-1">
            <h3 className="font-semibold text-lg leading-snug hover:text-primary transition-colors">{lesson.title}</h3>
          </Link>
          {lesson.summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{lesson.summary}</p>}
          {lesson.tags.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {lesson.tags.slice(0, 5).map((t) => (
                <Link key={t} to="/explore" search={{ tag: t }} className="px-2 py-0.5 rounded bg-muted text-xs font-mono text-muted-foreground hover:text-primary">
                  {t}
                </Link>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 font-mono">
            <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {lesson.like_count}</span>
            <span className="inline-flex items-center gap-1"><GitFork className="h-3.5 w-3.5" /> {lesson.fork_count}</span>
            <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {lesson.comment_count}</span>
            {typeof lesson.view_count === "number" && (
              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {lesson.view_count}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
