import { AccessToken } from "npm:livekit-server-sdk@2.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { roomName, roomType, isHost, username, displayName } = await req.json();

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const url = Deno.env.get("LIVEKIT_URL");

    if (!apiKey || !apiSecret || !url) {
      throw new Error("LiveKit credentials not configured");
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: username,
      name: displayName,
      ttl: "4h",
    });

    // Set permissions based on room type
    const baseGrant = {
      roomJoin: true,
      room: roomName,
      canSubscribe: true,
      canPublishData: true,
    };

    if (roomType === "tutoring" || roomType === "group") {
      token.addGrant({ ...baseGrant, canPublish: true });
    } else if (roomType === "classroom") {
      token.addGrant({
        ...baseGrant,
        canPublish: true,
        roomAdmin: isHost,
      });
    } else if (roomType === "battle") {
      token.addGrant({ ...baseGrant, canPublish: true });
    } else if (roomType === "assembly") {
      token.addGrant({
        ...baseGrant,
        canPublish: isHost,
        roomAdmin: isHost,
      });
    } else {
      token.addGrant({ ...baseGrant, canPublish: false });
    }

    const jwt = await token.toJwt();

    return new Response(
      JSON.stringify({ token: jwt, url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
// Both teacher and student have video + audio
<ClassroomCall
  roomName={`tutoring-${sessionId}`}
  isTeacher={profile?.account_type === "teacher"}
  onLeave={handleLeave}
/>
// Teacher has video, students are muted by default
// Teacher can unmute specific students
<ClassroomCall
  roomName={`class-${schoolId}-${classId}`}
  isTeacher={profile?.account_type === "teacher"}
  maxParticipants={100}
  onLeave={handleLeave}
/>
// Audio only, no video
// Both see each other's code in real time
<ArenaCall
  roomName={`battle-${battleId}`}
  audioOnly={true}
  onLeave={handleLeave}
/>
// One speaker at a time
// Everyone else on listen-only mode
<AssemblyCall
  roomName={`assembly-${schoolId}`}
  isHost={isSuperAdmin || isSchoolAdmin}
  onLeave={handleLeave}
/>