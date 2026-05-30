import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks,
  useParticipants,
  useLocalParticipant,
  RoomName,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  Hand,
  MonitorUp,
} from "lucide-react";
import { toast } from "sonner";
import type { RoomType } from "@/lib/livekit";

interface LeathaCallProps {
  roomName: string;
  roomType: RoomType;
  isHost?: boolean;
  onLeave: () => void;
  title?: string;
}

export function LeathaCall({
  roomName,
  roomType,
  isHost = false,
  onLeave,
  title,
}: LeathaCallProps) {
  const { profile } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [liveKitUrl, setLiveKitUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-livekit-token", {
          body: {
            roomName,
            roomType,
            isHost,
            username: profile?.username,
            displayName: profile?.display_name ?? profile?.username,
          },
        });

        if (error) throw error;
        setToken(data.token);
        setLiveKitUrl(data.url);
      } catch (err) {
        setError("Failed to join call. Please try again.");
        toast.error("Failed to join call");
      } finally {
        setLoading(false);
      }
    };

    if (profile) getToken();
  }, [roomName, profile]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Joining call...</p>
        </div>
      </div>
    );
  }

  if (error || !token || !liveKitUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-destructive">{error}</p>
          <Button className="mt-4" onClick={onLeave}>Go back</Button>
        </div>
      </div>
    );
  }

 return (
  <div className="fixed inset-0 z-50 bg-background flex flex-col">
    {/* Header — always on top */}
    <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-card z-10">
      <div>
        <p className="font-semibold text-sm">{title ?? roomName}</p>
        <p className="text-xs text-muted-foreground capitalize">{roomType} session</p>
      </div>
      <Button
        variant="destructive"
        size="sm"
        onClick={onLeave}
        className="gap-2"
      >
        <PhoneOff className="h-4 w-4" />
        End call
      </Button>
    </div>

    {/* LiveKit Room */}
    <div className="flex-1 overflow-hidden">
      <LiveKitRoom
        video={roomType === "tutoring" || roomType === "group" || isHost}
        audio={true}
        token={token}
        serverUrl={liveKitUrl}
        onDisconnected={onLeave}
        onError={(err) => {
          toast.error("Call error: " + err.message);
          onLeave();
        }}
        style={{ height: "100%", background: "var(--background)" }}
        data-lk-theme="default"
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>

    {/* Floating end call button — always visible */}
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
      <Button
        variant="destructive"
        size="lg"
        onClick={onLeave}
        className="rounded-full px-8 gap-2 shadow-lg"
      >
        <PhoneOff className="h-5 w-5" />
        End call
      </Button>
    </div>
  </div>
);
}