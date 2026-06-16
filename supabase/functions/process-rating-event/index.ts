import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RatingEngine, defaultConfig } from './ratingEngine.ts';  // adjust path

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 1. Parse request
  const { user_id, creator_id, event_type, quality_value, trust_delta } = await req.json();
  if (!user_id || !creator_id || !event_type || quality_value === undefined) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  }

  // 2. Load existing state from database
  const { data: stateRow, error: loadError } = await supabase
    .from('creator_rating_state')
    .select('engine_state')
    .eq('creator_id', creator_id)
    .single();

  let engine: RatingEngine;
  if (stateRow?.engine_state) {
    engine = new RatingEngine(defaultConfig, stateRow.engine_state);
  } else {
    engine = new RatingEngine(defaultConfig);
  }

  // 3. Process event
  const result = engine.processEvent(event_type, quality_value, Date.now(), trust_delta || 0);
  if (!result.allowed) {
    return new Response(JSON.stringify({ error: 'Event blocked due to low trust or velocity' }), { status: 403 });
  }

  // 4. Store event in rating_events table
  await supabase.from('rating_events').insert({
    creator_id,
    user_id,
    event_type,
    quality_value,
    trust_tau: result.trustTau,
    dqi_after: result.dqi,
  });

  // 5. Persist updated state
  await supabase.from('creator_rating_state').upsert({
    creator_id,
    engine_state: engine.exportState(),
    dqi_x: engine.getCurrent().dqi,
    lis_total: result.lis,
    active_lis: result.activeLis,
    updated_at: new Date().toISOString(),
  });

  // 6. Return new scores
  return new Response(JSON.stringify({
    dqi: result.dqi,
    lis: result.lis,
    activeLis: result.activeLis,
    trustTau: result.trustTau,
    confidence: engine.getCurrent().confidence,
  }), { status: 200 });
});