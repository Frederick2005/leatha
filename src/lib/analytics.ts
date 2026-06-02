import { supabase } from "@/integrations/supabase/client";

export type AnalyticsEvent =
  | "login" | "signup" | "session_start"
  | "lesson_view" | "lesson_complete" | "lesson_scroll" | "lesson_fork" | "lesson_like" | "lesson_created"
  | "challenge_attempt" | "challenge_view"
  | "suggestion_view" | "suggestion_upvote" | "suggestion_submit"
  | "feed_click" | "feed_scroll_depth"
  | "search"
  | "message_sent" | "voice_message_sent" | "comment_created" | "lesson_liked";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem("leatha_session");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("leatha_session", id);
  }
  return id;
}

function getDeviceType(): "mobile" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  return /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

export async function trackEvent(
  event: AnalyticsEvent,
  data: Record<string, unknown> = {},
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("analytics_events").insert({
      user_id: user.id,
      event_type: event,
      metadata: data as never,
      event_data: data as never,
      session_id: getSessionId(),
      device_type: getDeviceType(),
    } as never);
  } catch {
    /* analytics never block UX */
  }
}

let sessionStarted = false;
export function ensureSessionStart() {
  if (sessionStarted || typeof window === "undefined") return;
  sessionStarted = true;
  void trackEvent("session_start", {
    time_of_day: new Date().getHours(),
    day_of_week: new Date().getDay(),
  });
}
