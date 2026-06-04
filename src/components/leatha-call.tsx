import { LiveKitRoom, VideoConference, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/providers/auth-provider";
import { getLivekitToken } from "@/lib/livekit.functions";
import { Button } from "@/components/ui/button";
import { PhoneOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type RoomType = "tutoring" | "classroom" | "battle" | "assembly" | "group" | "audio" | "video";

interface LeathaCallProps {
  roomName: string;
  roomType: RoomType;
  isHost: boolean;
  title: string;
  onLeave: () => void;
}

export function LeathaCall({ roomName, roomType, isHost, title, onLeave }: LeathaCallProps) {
  const { profile } = useAuth();
  const fetchToken = useServerFn(getLivekitToken);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchToken({
          data: {
            roomName,
            roomType,
            isHost,
            username: profile.username,
            displayName: profile.display_name ?? profile.username,
          },
        });
        if (cancelled) return;
        setToken(data.token);
        setServerUrl(data.url);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to join call";
        setError(msg);
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [roomName, roomType, isHost, profile, fetchToken]);

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
          <p className="text-xs text-muted-foreground">Ensure LiveKit credentials are configured in project secrets.</p>
          <Button onClick={onLeave} variant="outline">Go back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="min-w-0">
          <h2 className="font-display font-semibold truncate">{title}</h2>
          <p className="text-xs text-muted-foreground capitalize">{roomType} · {isHost ? "Host" : "Participant"}</p>
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
          video={roomType === "video" || roomType === "tutoring" || roomType === "group" || (roomType === "classroom" && isHost) || (roomType === "assembly" && isHost)}
          onDisconnected={onLeave}
          onError={(err) => { toast.error("Call error: " + err.message); }}
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
