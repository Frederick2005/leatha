import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string | null;
  url?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
};

export function UserAvatar({ name, url, size = "md", className }: UserAvatarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary-muted font-mono font-semibold text-primary uppercase ring-1 ring-border overflow-hidden",
        sizeMap[size],
        className,
      )}
    >
      {url ? (
        <img src={url} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        <span>{initials(name ?? "")}</span>
      )}
    </div>
  );
}
