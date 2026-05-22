import { createFileRoute, Link } from "@tanstack/react-router";
import { WifiOff, BookOpen, Trophy, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/offline")({
  component: OfflinePage,
});

function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="text-center max-w-sm w-full">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
          <WifiOff className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">You're offline</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          No internet connection detected. You can still
          access content you've previously viewed.
        </p>

        {/* What's available offline */}
        <div className="mt-6 rounded-lg border border-border bg-card p-4 text-left space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Available offline
          </p>
          <div className="flex items-center gap-3 text-sm">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <span>Lessons you've already opened</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Trophy className="h-4 w-4 text-primary shrink-0" />
            <span>Arena challenges you've visited</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-primary shrink-0" />
            <span>Your profile and settings</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-6">
          <Button onClick={() => window.history.back()}>
            Go back
          </Button>
          <Button variant="outline" asChild>
            <Link to="/feed">Try feed</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Your actions will sync automatically when you reconnect.
        </p>
      </div>
    </div>
  );
}