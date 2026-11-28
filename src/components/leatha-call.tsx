import { LiveKitRoom, VideoConference, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PhoneOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type RoomType = "audio" | "video";

interface LeathaCallProps {
  roomName: string;
  roomType: RoomType;
  otherUserId: string;
  title: string;
  onLeave: () => void;
}

export function LeathaCall({ roomName, roomType, otherUserId, title, onLeave }: LeathaCallProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError("Please sign in again to start a call.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Please sign in again to start a call.");
        const response = await fetch("/api/get-token", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ roomName, roomType, otherUserId }),
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !data.participant_token || !data.server_url) {
          throw new Error(data?.error ?? "Failed to join call");
        }
        setToken(data.participant_token);
        setServerUrl(data.server_url);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to join call";
        setError(msg);
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomName, roomType, otherUserId, userId, attempt]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Connecting to call…</p>
        </div>
      </div>
    );
  }

  if (error || !token || !serverUrl) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-6">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-destructive font-medium">{error ?? "Could not connect to call"}</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
            <Button onClick={onLeave} variant="outline">
              Go back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="min-w-0">
          <h2 className="font-display font-semibold truncate">{title}</h2>
          <p className="text-xs text-muted-foreground capitalize">{roomType} · Private call</p>
        </div>
        <Button variant="destructive" size="sm" onClick={onLeave} className="gap-2">
          <PhoneOff className="h-4 w-4" /> End call
        </Button>
      </header>
      <div className="flex-1 min-h-0">
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect
          audio
          video={roomType === "video"}
          onDisconnected={onLeave}
          onError={(err: Error) => {
            const invalidKey = /invalid api key/i.test(err.message);
            const msg = invalidKey
              ? "Call server rejected the LiveKit API key. The key, secret and URL must be from the same LiveKit project."
              : "Call error: " + err.message;
            setError(msg);
            toast.error(msg);
          }}
          data-lk-theme="default"
          style={{ height: "100%", background: "hsl(var(--background))" }}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
}
