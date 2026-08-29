import { supabase } from '@/integrations/supabase/client';

export async function submitRatingEvent(params: {
  creator_id: string;
  event_type: string;
  quality_value: number;
  trust_delta?: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const response = await supabase.functions.invoke('process-rating-event', {
    body: { ...params, user_id: user.id }
  });
  if (response.error) throw response.error;
  return response.data;
}

export async function getCreatorRating(creatorId: string) {
  const { data, error } = await supabase
    .from('creator_rating_state')
    .select('dqi_x, lis_total, active_lis, updated_at, engine_state')
    .eq('creator_id', creatorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    dqi: data.dqi_x,
    lis: data.lis_total,
    activeLis: data.active_lis,
    updatedAt: data.updated_at,
  };
}