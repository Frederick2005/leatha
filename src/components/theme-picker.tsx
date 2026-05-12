import { Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/providers/theme-provider";
import { cn } from "@/lib/utils";

interface ThemePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThemePicker({ open, onOpenChange }: ThemePickerProps) {
  const { theme, setTheme, darkMode, setDarkMode } = useTheme();
  const base = THEMES.filter((t) => !t.premium);
  const premium = THEMES.filter((t) => t.premium);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Theme studio
          </DialogTitle>
          <DialogDescription>
            15 themes, each with light and dark mode. Saved to your profile.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border border-border p-3 bg-surface">
          <Label htmlFor="dark-toggle" className="text-sm font-medium">
            Dark mode
          </Label>
          <Switch id="dark-toggle" checked={darkMode} onCheckedChange={setDarkMode} />
        </div>

        <div>
          <h3 className="text-xs uppercase font-mono tracking-wider text-muted-foreground mb-2">
            Base
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {base.map((t) => (
              <ThemeChip
                key={t.id}
                id={t.id}
                label={t.label}
                swatch={t.swatch}
                active={theme === t.id}
                onSelect={setTheme}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs uppercase font-mono tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Premium
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {premium.map((t) => (
              <ThemeChip
                key={t.id}
                id={t.id}
                label={t.label}
                swatch={t.swatch}
                active={theme === t.id}
                onSelect={setTheme}
                premium
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ThemeChip({
  id,
  label,
  swatch,
  active,
  onSelect,
  premium,
}: {
  id: string;
  label: string;
  swatch: string;
  active: boolean;
  onSelect: (id: never) => void;
  premium?: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(id as never)}
      className={cn(
        "group relative flex flex-col items-center gap-1.5 rounded-md border p-2 transition-all",
        active ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40",
      )}
    >
      <div
        className="h-10 w-full rounded-md border border-border/50"
        style={{
          background: `linear-gradient(135deg, ${swatch}, color-mix(in oklab, ${swatch} 50%, transparent))`,
        }}
      />
      <span className="text-[11px] font-medium leading-tight text-center">{label}</span>
      {premium && (
        <span className="absolute top-1 right-1 text-[8px] uppercase font-mono bg-primary text-primary-foreground px-1 rounded">
          ★
        </span>
      )}
      {active && (
        <span className="absolute top-1 left-1 h-4 w-4 rounded-full bg-primary text-primary-foreground grid place-items-center">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}
    </button>
  );
}
