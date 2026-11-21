import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { TrackSource } from "@livekit/protocol";

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || process.env.LIVEKIT_URL;
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

export type RoomType = "audio" | "video";

interface TokenOptions {
  roomName: string;
  username: string;
  displayName: string;
  roomType: RoomType;
}

export async function generateLiveKitToken({
  roomName,
  username,
  displayName,
  roomType,
}: TokenOptions): Promise<string> {
  if (!API_KEY || !API_SECRET || !LIVEKIT_URL) {
    throw new Error("LiveKit is not configured on the server");
  }
  const token = new AccessToken(API_KEY, API_SECRET, {
    identity: username,
    name: displayName,
    ttl: "1h",
  });

  // This helper intentionally issues peer tokens only. Host/room-admin grants
  // must be implemented in a separately authorized server workflow.
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canPublishSources:
      roomType === "audio"
        ? [TrackSource.MICROPHONE]
        : [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE],
  });

  return token.toJwt();
}

export function getLiveKitUrl(): string {
  return LIVEKIT_URL!;
}

export async function deleteRoom(roomName: string) {
  const roomService = new RoomServiceClient(
    LIVEKIT_URL!.replace("wss://", "https://"),
    API_KEY!,
    API_SECRET!,
  );
  await roomService.deleteRoom(roomName);
}
