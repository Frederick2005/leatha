export type ThemeId =
  | "blue" | "teal" | "green" | "purple" | "red"
  | "orange" | "yellow" | "pink" | "indigo" | "cyan"
  | "neon-cyber" | "sunset" | "ocean" | "forest" | "midnight-gold";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  swatch: string; // CSS color for preview chip
  premium?: boolean;
}

export const THEMES: ThemeMeta[] = [
  { id: "blue", label: "Blue", swatch: "oklch(0.55 0.2 255)" },
  { id: "teal", label: "Teal", swatch: "oklch(0.6 0.13 195)" },
  { id: "green", label: "Green", swatch: "oklch(0.6 0.16 150)" },
  { id: "purple", label: "Purple", swatch: "oklch(0.55 0.22 295)" },
  { id: "red", label: "Red", swatch: "oklch(0.58 0.22 25)" },
  { id: "orange", label: "Orange", swatch: "oklch(0.65 0.2 50)" },
  { id: "yellow", label: "Yellow", swatch: "oklch(0.78 0.16 90)" },
  { id: "pink", label: "Pink", swatch: "oklch(0.65 0.22 0)" },
  { id: "indigo", label: "Indigo", swatch: "oklch(0.5 0.22 275)" },
  { id: "cyan", label: "Cyan", swatch: "oklch(0.65 0.14 215)" },
  { id: "neon-cyber", label: "Neon Cyber", swatch: "oklch(0.75 0.28 145)", premium: true },
  { id: "sunset", label: "Sunset", swatch: "oklch(0.7 0.2 30)", premium: true },
  { id: "ocean", label: "Ocean Deep", swatch: "oklch(0.55 0.15 230)", premium: true },
  { id: "forest", label: "Forest Pro", swatch: "oklch(0.5 0.13 145)", premium: true },
  { id: "midnight-gold", label: "Midnight Gold", swatch: "oklch(0.78 0.16 80)", premium: true },
];

export const THEME_IDS = THEMES.map((t) => t.id) as ThemeId[];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return !!value && (THEME_IDS as string[]).includes(value);
}
