import { Link } from "@tanstack/react-router";
import { Eye, ArrowUp, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { timeAgo } from "@/lib/utils";

export interface SuggestionRow {
  id: string;
  title: string;
  description: string;
  subject: string;
  upvote_count: number;
  view_count: number;
  status: string;
  claimed_by: string | null;
  lesson_id: string | null;
  created_at: string;
  suggester?: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
  claimer?: { username: string } | null;
  hasUpvoted?: boolean;
  onUpvote?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  open: "outline",
  in_progress: "secondary",
  completed: "default",
};

export function SuggestionCard({ s }: { s: SuggestionRow }) {
  const exact = format(new Date(s.created_at), "MMM d, yyyy 'at' h:mm a");
  return (
    <article className="rounded-lg border border-border bg-card hover:border-primary/40 transition-colors p-5">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1">
          <Button
            size="sm"
            variant={s.hasUpvoted ? "default" : "outline"}
            className="h-10 w-10 p-0"
            onClick={(e) => { e.preventDefault(); s.onUpvote?.(); }}
            aria-label="Upvote"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono font-semibold">{s.upvote_count}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="secondary">{s.subject}</Badge>
            <Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
          </div>
          <Link to="/suggestions/$id" params={{ id: s.id }} className="block">
            <h3 className="font-semibold text-lg leading-snug hover:text-primary">{s.title}</h3>
          </Link>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>

          {s.status === "in_progress" && s.claimer && (
            <p className="text-xs text-primary mt-2">
              Teacher @{s.claimer.username} is working on this
            </p>
          )}
          {s.status === "completed" && s.lesson_id && (
            <Link to="/lessons/$lessonId" params={{ lessonId: s.lesson_id }} className="text-xs text-primary mt-2 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Lesson published — view it
            </Link>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3 font-mono flex-wrap">
            {s.suggester && (
              <Link to="/u/$username" params={{ username: s.suggester.username }} className="inline-flex items-center gap-1.5 hover:text-primary">
                <UserAvatar size="sm" name={s.suggester.display_name ?? s.suggester.username} url={s.suggester.avatar_url} />
                @{s.suggester.username}
              </Link>
            )}
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {s.view_count}
            </span>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 cursor-default">
                    <Clock className="h-3.5 w-3.5" /> {timeAgo(s.created_at)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{exact}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-muted-foreground/60">· {exact}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
