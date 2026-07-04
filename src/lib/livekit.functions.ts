import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  roomName: z.string().min(1).max(200),
  roomType: z.string().min(1).max(40),
  isHost: z.boolean(),
  username: z.string().min(1).max(80),
  displayName: z.string().min(1).max(200),
});

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getRuntimeEnvValue(...keys: string[]) {
  const candidates = keys.filter(Boolean);
  for (const key of candidates) {
    const value = process.env?.[key];
    if (value) return value;
  }
  if (typeof import.meta !== "undefined") {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    for (const key of candidates) {
      const value = env?.[key];
      if (value) return value;
    }
    for (const key of candidates) {
      const viteKey = key.startsWith("VITE_") ? key : `VITE_${key}`;
      const value = env?.[viteKey];
      if (value) return value;
    }
  }
  return undefined;
}

async function signLivekitToken(apiKey: string, apiSecret: string, identity: string, name: string, room: string, isHost: boolean) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: apiKey,
    sub: identity,
    name,
    nbf: now,
    iat: now,
    exp: now + 60 * 60 * 6,
    video: {
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost,
      roomCreate: isHost,
    },
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`;
}

function getPermissions(roomType: string, isHost: boolean) {
  switch (roomType) {
    case "tutoring":
      return { canPublish: true, canSubscribe: true, canPublishData: true, roomAdmin: isHost };
    case "classroom":
      return {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        roomAdmin: isHost,
        canPublishSources: isHost ? ["camera", "microphone", "screen_share"] : ["microphone"],
      };
    case "battle":
      return { canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: ["microphone"] };
    case "assembly":
      return {
        canPublish: isHost,
        canSubscribe: true,
        canPublishData: isHost,
        roomAdmin: isHost,
        canPublishSources: isHost ? ["camera", "microphone"] : [],
      };
    case "group":
    case "video":
    case "audio":
      return { canPublish: true, canSubscribe: true, canPublishData: true };
    default:
      return { canPublish: false, canSubscribe: true };
  }
}

export const getLivekitToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const apiKey = getRuntimeEnvValue("LIVEKIT_API_KEY", "VITE_LIVEKIT_API_KEY");
    const apiSecret = getRuntimeEnvValue("LIVEKIT_API_SECRET", "VITE_LIVEKIT_API_SECRET");
    const url = getRuntimeEnvValue("LIVEKIT_URL", "VITE_LIVEKIT_URL");
    if (!apiKey || !apiSecret || !url) {
      throw new Error("LiveKit not configured. Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or LIVEKIT_URL environment variables.");
    }
    const identity = `${data.username}:${data.displayName}`;
    const token = await signLivekitToken(apiKey, apiSecret, identity, data.displayName, data.roomName, data.isHost);
    return { token, url };
  });
