// app/routes/api/get-token.ts
import { json } from '@tanstack/start';
import { createAPIFileRoute } from '@tanstack/start/api';
import { AccessToken } from 'livekit-server-sdk';
import { loadEnv } from 'vite';

function getRuntimeEnvValue(...keys: string[]) {
  const candidates = keys.filter(Boolean);
  for (const key of candidates) {
    const value = process.env?.[key];
    if (value) return value;
  }

  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    for (const key of candidates) {
      const value = env?.[key];
      if (value) return value;
    }
    for (const key of candidates) {
      const viteKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
      const value = env?.[viteKey];
      if (value) return value;
    }
  }

  const loadedEnv = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
  for (const key of candidates) {
    const value = loadedEnv[key];
    if (value) return value;
  }
  for (const key of candidates) {
    const viteKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
    const value = loadedEnv[viteKey];
    if (value) return value;
  }

  return undefined;
}

export const APIRoute = createAPIFileRoute('/api/get-token')({
  POST: async ({ request }) => {
    try {
      const body = await request.json();
      const { roomName, participantName, participantIdentity, roomType, isHost = false } = body;

      if (!roomName) {
        return json({ error: 'roomName is required' }, { status: 400 });
      }

      const apiKey = getRuntimeEnvValue('LIVEKIT_API_KEY', 'VITE_LIVEKIT_API_KEY');
      const apiSecret = getRuntimeEnvValue('LIVEKIT_API_SECRET', 'VITE_LIVEKIT_API_SECRET');
      const wsUrl = getRuntimeEnvValue('LIVEKIT_URL', 'VITE_LIVEKIT_URL');

      if (!apiKey || !apiSecret || !wsUrl) {
        console.error('LiveKit credentials missing');
        return json({ error: 'Server configuration error' }, { status: 500 });
      }

      const at = new AccessToken(apiKey, apiSecret, {
        identity: participantIdentity || participantName || 'anonymous',
        name: participantName,
        ttl: '10m',
      });

      const baseGrant = {
        roomJoin: true,
        room: roomName,
        canSubscribe: true,
        canPublishData: true,
      } as const;

      if (roomType === 'audio') {
        at.addGrant({
          ...baseGrant,
          canPublish: true,
          canPublishSources: ['microphone'],
        });
      } else if (roomType === 'video') {
        at.addGrant({
          ...baseGrant,
          canPublish: true,
          canPublishSources: ['camera', 'microphone', 'screen_share'],
        });
      } else {
        at.addGrant({
          ...baseGrant,
          canPublish: Boolean(isHost),
          canPublishSources: isHost ? ['camera', 'microphone', 'screen_share'] : [],
          roomAdmin: Boolean(isHost),
        });
      }

      const token = await at.toJwt();

      return json({
        server_url: wsUrl,
        participant_token: token,
      });
    } catch (error) {
      console.error('Token generation error:', error);
      return json({ error: 'Failed to generate token' }, { status: 500 });
    }
  },
});