import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || process.env.LIVEKIT_URL;
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

export type RoomType = "tutoring" | "classroom" | "battle" | "assembly" | "group";

interface TokenOptions {
  roomName: string;
  username: string;
  displayName: string;
  roomType: RoomType;
  isHost: boolean;
}

export async function generateLiveKitToken({
  roomName,
  username,
  displayName,
  roomType,
  isHost,
}: TokenOptions): Promise<string> {
  const token = new AccessToken(API_KEY!, API_SECRET!, {
    identity: username,
    name: displayName,
    ttl: "4h",
  });

  // Permissions based on room type and role
  const permissions = getPermissions(roomType, isHost);

  token.addGrant({
    roomJoin: true,
    room: roomName,
    ...permissions,
  });

  return token.toJwt();
}

function getPermissions(roomType: RoomType, isHost: boolean) {
  switch (roomType) {
    case "tutoring":
      // Both can publish video and audio
      return {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        roomAdmin: isHost,
      };

    case "classroom":
      // Teacher publishes video, students audio only by default
      return {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        roomAdmin: isHost,
        // Students start muted — teacher can unmute
        canPublishSources: isHost
          ? ["camera", "microphone", "screen_share"]
          : ["microphone"],
      };

    case "battle":
      // Audio only for arena battles
      return {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canPublishSources: ["microphone"],
      };

    case "assembly":
      // Only host speaks, everyone listens
      return {
        canPublish: isHost,
        canSubscribe: true,
        canPublishData: isHost,
        roomAdmin: isHost,
        canPublishSources: isHost
          ? ["camera", "microphone"]
          : [],
      };

    case "group":
      // Everyone can publish
      return {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      };

    default:
      return {
        canPublish: false,
        canSubscribe: true,
      };
  }
}

export function getLiveKitUrl(): string {
  return LIVEKIT_URL!;
}

export async function deleteRoom(roomName: string) {
  const roomService = new RoomServiceClient(
    LIVEKIT_URL!.replace("wss://", "https://"),
    API_KEY!,
    API_SECRET!
  );
  await roomService.deleteRoom(roomName);
}