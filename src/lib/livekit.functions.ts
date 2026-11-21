import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AccessToken } from "livekit-server-sdk";
import { TrackSource } from "@livekit/protocol";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  roomName: z.string().min(1).max(200),
  roomType: z.enum(["audio", "video"]),
  otherUserId: z.string().uuid(),
});

function getServerEnv(name: string) {
  return process.env?.[name];
}

export const getLivekitToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.otherUserId === userId) throw new Error("You cannot call yourself");

    const expectedRoom = `dm-${[userId, data.otherUserId].sort().join("-")}`;
    if (data.roomName !== expectedRoom) throw new Response("Forbidden call room", { status: 403 });

    const { data: otherProfile, error: otherError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.otherUserId)
      .maybeSingle();
    if (otherError || !otherProfile)
      throw new Response("Call participant not found", { status: 404 });

    const { data: canInteract, error: interactionError } = await supabase.rpc(
      "can_interact_with_user",
      { _other_user_id: data.otherUserId },
    );
    if (interactionError || canInteract !== true) {
      throw new Response("Calling is unavailable for this conversation", { status: 403 });
    }

    const apiKey = getServerEnv("LIVEKIT_API_KEY");
    const apiSecret = getServerEnv("LIVEKIT_API_SECRET");
    const url = getServerEnv("LIVEKIT_URL");
    if (!apiKey || !apiSecret || !url) throw new Error("LiveKit is not configured");

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", userId)
      .maybeSingle();
    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: profile?.display_name || profile?.username || "Leatha user",
      ttl: "1h",
    });
    token.addGrant({
      roomJoin: true,
      room: data.roomName,
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      canPublishSources:
        data.roomType === "audio"
          ? [TrackSource.MICROPHONE]
          : [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE],
    });
    return { token: await token.toJwt(), url };
  });
