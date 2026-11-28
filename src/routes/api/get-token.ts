import { createFileRoute } from "@tanstack/react-router";

import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { TrackSource } from "@livekit/protocol";
import { createClient } from "@supabase/supabase-js";

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env?.[key]?.trim();
    if (value) return value;
  }
  const viteEnv = import.meta.env as Record<string, string | undefined>;
  for (const key of keys) {
    const value = viteEnv[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export const Route = createFileRoute("/api/get-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authorization = request.headers.get("authorization") ?? "";
          const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
          if (!accessToken)
            return Response.json({ error: "Authentication required" }, { status: 401 });

          const body = (await request.json()) as {
            roomName?: string;
            roomType?: string;
            otherUserId?: string;
          };
          const { roomName, roomType, otherUserId } = body;
          if (!roomName || roomName.length > 200 || !otherUserId) {
            return Response.json(
              { error: "roomName and otherUserId are required" },
              { status: 400 },
            );
          }
          if (roomType !== "audio" && roomType !== "video") {
            return Response.json({ error: "Unsupported call type" }, { status: 400 });
          }
          if (!/^[0-9a-f-]{36}$/i.test(otherUserId)) {
            return Response.json({ error: "Invalid call participant" }, { status: 400 });
          }

          const supabaseUrl = envValue("SUPABASE_URL", "VITE_SUPABASE_URL");
          const supabaseKey = envValue("SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY");
          if (!supabaseUrl || !supabaseKey) {
            return Response.json(
              { error: "Authentication service is not configured" },
              { status: 500 },
            );
          }

          const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
          });
          const {
            data: { user },
            error: authError,
          } = await supabase.auth.getUser(accessToken);
          if (authError || !user)
            return Response.json({ error: "Invalid or expired session" }, { status: 401 });
          if (otherUserId === user.id)
            return Response.json({ error: "You cannot call yourself" }, { status: 400 });

          const expectedRoom = `dm-${[user.id, otherUserId].sort().join("-")}`;
          if (roomName !== expectedRoom) {
            return Response.json(
              { error: "You are not authorized for this call room" },
              { status: 403 },
            );
          }

          const { data: otherProfile, error: otherError } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", otherUserId)
            .maybeSingle();
          if (otherError || !otherProfile) {
            return Response.json({ error: "Call participant was not found" }, { status: 404 });
          }

          const { data: canInteract, error: interactionError } = await supabase.rpc(
            "can_interact_with_user",
            { _other_user_id: otherUserId },
          );
          if (interactionError || canInteract !== true) {
            return Response.json(
              { error: "Calling is unavailable for this conversation" },
              { status: 403 },
            );
          }

          const apiKey = envValue("LIVEKIT_API_KEY");
          const apiSecret = envValue("LIVEKIT_API_SECRET");
          const serverUrl = envValue("LIVEKIT_URL");
          if (!apiKey || !apiSecret || !serverUrl) {
            return Response.json(
              { error: "Calling is not configured on this server" },
              { status: 503 },
            );
          }

          // Verify the key/secret really belong to the LiveKit project at LIVEKIT_URL before
          // handing out a token. Otherwise the browser only sees LiveKit's vague
          // "could not establish signal connection: invalid API key".
          try {
            const httpUrl = serverUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
            await new RoomServiceClient(httpUrl, apiKey, apiSecret).listRooms([roomName]);
          } catch (verifyError) {
            const msg = verifyError instanceof Error ? verifyError.message : String(verifyError);
            if (/unauthenticated|invalid api key|invalid token|permission|401|403/i.test(msg)) {
              console.error("LiveKit rejected the configured API key/secret", msg);
              return Response.json(
                {
                  error:
                    "Calling is misconfigured: LiveKit rejected the API key/secret. Make sure LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL all come from the same LiveKit project.",
                },
                { status: 503 },
              );
            }
            // network/other errors: don't block the call, let the client try.
            console.warn("LiveKit credential check skipped", msg);
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("username, display_name")
            .eq("id", user.id)
            .maybeSingle();
          const displayName = profile?.display_name || profile?.username || "Leatha user";

          const token = new AccessToken(apiKey, apiSecret, {
            identity: user.id,
            name: displayName,
            ttl: "1h",
          });
          // Direct-message calls are peer-to-peer. Neither caller can grant itself
          // room-admin rights by changing a request-body flag.
          token.addGrant({
            roomJoin: true,
            room: roomName,
            canSubscribe: true,
            canPublish: true,
            canPublishData: true,
            canPublishSources:
              roomType === "audio"
                ? [TrackSource.MICROPHONE]
                : [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE],
          });

          return Response.json({ server_url: serverUrl, participant_token: await token.toJwt() });
        } catch (error) {
          console.error("LiveKit token request failed", error);
          return Response.json({ error: "Unable to start call" }, { status: 500 });
        }
      },
    },
  },
});
