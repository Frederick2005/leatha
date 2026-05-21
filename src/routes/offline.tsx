import { createFileRoute, Link } from "@tanstack/react-router";
import { WifiOff, BookOpen, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/offline")({
  component: OfflinePage,
});

function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-6">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">You're offline</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          No internet connection. You can still access 
          cached lessons and challenges you've viewed before.
        </p>
        <div className="flex flex-col gap-3 mt-8">
          <Button asChild>
            <Link to="/feed">
              <BookOpen className="h-4 w-4 mr-2" />
              Go to Feed
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/arena">
              <Trophy className="h-4 w-4 mr-2" />
              Go to Arena
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-6">
          Your progress will sync when you reconnect.
        </p>
      </div>
    </div>
  );
}