import { AccessToken } from "npm:livekit-server-sdk@2.6.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const accessToken = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { roomName, roomType, otherUserId } = await req.json();
    if (typeof roomName !== "string" || roomName.length > 200 || typeof otherUserId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid call details" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (roomType !== "audio" && roomType !== "video") {
      return new Response(JSON.stringify({ error: "Unsupported call type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Supabase authentication is not configured");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[0-9a-f-]{36}$/i.test(otherUserId) || otherUserId === user.id) {
      return new Response(JSON.stringify({ error: "Invalid call participant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expectedRoom = `dm-${[user.id, otherUserId].sort().join("-")}`;
    if (roomName !== expectedRoom) {
      return new Response(JSON.stringify({ error: "You are not authorized for this call room" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: otherProfile, error: otherError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", otherUserId)
      .maybeSingle();
    if (otherError || !otherProfile) {
      return new Response(JSON.stringify({ error: "Call participant was not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: canInteract, error: interactionError } = await supabase.rpc(
      "can_interact_with_user",
      { _other_user_id: otherUserId },
    );
    if (interactionError || canInteract !== true) {
      return new Response(
        JSON.stringify({ error: "Calling is unavailable for this conversation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const url = Deno.env.get("LIVEKIT_URL");
    if (!apiKey || !apiSecret || !url) throw new Error("LiveKit is not configured");

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle();
    const token = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: profile?.display_name || profile?.username || "Leatha user",
      ttl: "1h",
    });
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      canPublishSources:
        roomType === "audio" ? ["microphone"] : ["camera", "microphone", "screen_share"],
    });

    return new Response(JSON.stringify({ token: await token.toJwt(), url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("LiveKit token generation failed", error);
    return new Response(JSON.stringify({ error: "Unable to start call" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
