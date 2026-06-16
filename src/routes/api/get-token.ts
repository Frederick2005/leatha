// app/routes/api/get-token.ts
import { json } from '@tanstack/start';
import { createAPIFileRoute } from '@tanstack/start/api';
import { AccessToken } from 'livekit-server-sdk';

export const APIRoute = createAPIFileRoute('/api/get-token')({
  POST: async ({ request }) => {
    try {
      // Get the request body
      const body = await request.json();
      const { roomName, participantName, participantIdentity } = body;
      
      // Validate required fields
      if (!roomName) {
        return json({ error: 'roomName is required' }, { status: 400 });
      }
      
      // Get credentials from environment variables
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const wsUrl = process.env.LIVEKIT_URL;
      
      if (!apiKey || !apiSecret || !wsUrl) {
        console.error('LiveKit credentials missing');
        return json({ error: 'Server configuration error' }, { status: 500 });
      }
      
      // Create the access token
      const at = new AccessToken(apiKey, apiSecret, {
        identity: participantIdentity || participantName || 'anonymous',
        name: participantName,
        // Token expires after 10 minutes
        ttl: '10m',
      });
      
      // Add video grants (permissions)
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,      // Allow publishing audio/video
        canSubscribe: true,    // Allow subscribing to others
        canPublishData: true,  // Allow sending data messages
      });
      
      // Generate the token
      const token = await at.toJwt();
      
      // Return the token and server URL to the client
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