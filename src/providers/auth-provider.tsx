import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme: string;
  dark_mode: boolean;
  account_type: "student" | "teacher" | "administrator";
  school: string | null;
  points: number;
  lesson_count: number;
  fork_received_count: number;
  follower_count: number;
  following_count: number;
  created_at: string;
}

export type AppRole = "user" | "moderator" | "admin";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  roles: AppRole[];
  isAdmin: boolean;
  isModerator: boolean;
  isModOrAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfileAndRoles = useCallback(async (userId: string) => {
    try {
      const [profileResp, rolesResp] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      if (profileResp.error) console.error("Failed to load profile", profileResp.error);
      if (rolesResp.error) console.error("Failed to load roles", rolesResp.error);

      setProfile((profileResp.data as ProfileRow | null) ?? null);
      setRoles(((rolesResp.data ?? []) as { role: AppRole }[]).map((r) => r.role));
    } catch (error) {
      console.error("Auth bootstrap failed to load profile/roles", error);
      setProfile(null);
      setRoles([]);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfileAndRoles(session.user.id);
  }, [session, loadProfileAndRoles]);

  // ---- 8-hour inactivity auto-logout ----
  const MAX_SESSION_MS = 8 * 60 * 60 * 1000; // 8 hours
  const LAST_ACTIVITY_KEY = "sc_last_activity";

  useEffect(() => {
    // CRITICAL: subscribe BEFORE getSession to avoid races
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setLoading(false);
      if (newSession?.user) {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch { /* noop */ }
        }
        // Defer profile load to avoid recursive deadlock with auth callback
        setTimeout(() => {
          void loadProfileAndRoles(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        try { localStorage.removeItem(LAST_ACTIVITY_KEY); } catch { /* noop */ }
      }
    });

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();

        if (data.session?.user) {
          // Enforce 8h max session
          let last = 0;
          try { last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? 0); } catch { /* noop */ }
          if (last && Date.now() - last > MAX_SESSION_MS) {
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
            setRoles([]);
            return;
          }
          if (!last) {
            try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch { /* noop */ }
          }

          setSession(data.session);
          void loadProfileAndRoles(data.session.user.id);
        } else {
          setSession(data.session);
          setProfile(null);
          setRoles([]);
        }
      } catch (error) {
        console.error("Failed to restore auth session", error);
        setSession(null);
        setProfile(null);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    })();

    // Refresh activity timestamp on user interaction
    const bump = () => {
      try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch { /* noop */ }
    };
    window.addEventListener("click", bump);
    window.addEventListener("keydown", bump);

    // Periodically check for expired session
    const interval = window.setInterval(() => {
      let last = 0;
      try { last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? 0); } catch { /* noop */ }
      if (last && Date.now() - last > MAX_SESSION_MS) {
        void supabase.auth.signOut();
      }
    }, 60 * 1000);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("click", bump);
      window.removeEventListener("keydown", bump);
      window.clearInterval(interval);
    };
  }, [loadProfileAndRoles]);

  const signOut = useCallback(async () => {
    try { localStorage.removeItem("sc_last_activity"); } catch { /* noop */ }
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isAdmin = roles.includes("admin");
    const isModerator = roles.includes("moderator");
    return {
      session,
      user: session?.user ?? null,
      profile,
      roles,
      isAdmin,
      isModerator,
      isModOrAdmin: isAdmin || isModerator,
      loading,
      refreshProfile,
      signOut,
    };
  }, [session, profile, roles, loading, refreshProfile, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
