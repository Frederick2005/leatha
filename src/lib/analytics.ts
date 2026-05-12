import { supabase } from "@/integrations/supabase/client";

export type AnalyticsEvent =
  | "login"
  | "signup"
  | "lesson_view"
  | "lesson_created"
  | "lesson_forked"
  | "message_sent"
  | "voice_message_sent"
  | "comment_created"
  | "lesson_liked";

export async function trackEvent(event: AnalyticsEvent, metadata: Record<string, unknown> = {}) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("analytics_events").insert({
      user_id: user.id,
      event_type: event,
      metadata: metadata as never,
    });
  } catch {
    /* analytics never block UX */
  }
}
