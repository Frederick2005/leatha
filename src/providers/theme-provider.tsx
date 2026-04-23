import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { isThemeId, type ThemeId } from "@/lib/themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";

interface ThemeContextValue {
  theme: ThemeId;
  darkMode: boolean;
  setTheme: (id: ThemeId) => void;
  setDarkMode: (dark: boolean) => void;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "skillchain.theme";
const DARK_KEY = "skillchain.dark";

function readInitialTheme(): { theme: ThemeId; darkMode: boolean } {
  if (typeof window === "undefined") return { theme: "blue", darkMode: true };
  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  const storedDark = window.localStorage.getItem(DARK_KEY);
  return {
    theme: isThemeId(storedTheme) ? storedTheme : "blue",
    darkMode: storedDark == null ? true : storedDark === "1",
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [theme, setThemeState] = useState<ThemeId>(() => readInitialTheme().theme);
  const [darkMode, setDarkModeState] = useState<boolean>(() => readInitialTheme().darkMode);

  // Apply to <html> on every change
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", darkMode);
  }, [theme, darkMode]);

  // Sync from profile on login
  useEffect(() => {
    if (profile) {
      if (isThemeId(profile.theme)) setThemeState(profile.theme);
      setDarkModeState(profile.dark_mode);
    }
  }, [profile]);

  const persist = useCallback(async (next: { theme?: ThemeId; darkMode?: boolean }) => {
    if (typeof window !== "undefined") {
      if (next.theme) window.localStorage.setItem(STORAGE_KEY, next.theme);
      if (next.darkMode != null) window.localStorage.setItem(DARK_KEY, next.darkMode ? "1" : "0");
    }
    if (user) {
      await supabase
        .from("profiles")
        .update({
          ...(next.theme ? { theme: next.theme } : {}),
          ...(next.darkMode != null ? { dark_mode: next.darkMode } : {}),
        })
        .eq("id", user.id);
    }
  }, [user]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    void persist({ theme: id });
  }, [persist]);

  const setDarkMode = useCallback((dark: boolean) => {
    setDarkModeState(dark);
    void persist({ darkMode: dark });
  }, [persist]);

  const toggleDarkMode = useCallback(() => {
    setDarkModeState((prev) => {
      const next = !prev;
      void persist({ darkMode: next });
      return next;
    });
  }, [persist]);

  return (
    <ThemeContext.Provider value={{ theme, darkMode, setTheme, setDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
