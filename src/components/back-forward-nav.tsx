import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Persistent Back/Forward buttons — useful in PWA/desktop shells where the
 * browser chrome is not visible.
 */
export function BackForwardNav({ className }: { className?: string }) {
  const router = useRouter();
  const [state, setState] = useState({ canBack: false, canForward: false });

  useEffect(() => {
    const update = () => {
      const historyState = window.history.state as { idx?: number } | null;
      const idx = typeof historyState?.idx === "number" ? historyState.idx : Math.max(0, window.history.length - 1);
      const len = typeof window.history.length === "number" ? window.history.length : 1;
      setState({ canBack: idx > 0, canForward: idx < len - 1 });
    };

    update();
    const unsub = router.subscribe("onResolved", update);
    window.addEventListener("popstate", update);
    window.addEventListener("pageshow", update);

    return () => {
      unsub?.();
      window.removeEventListener("popstate", update);
      window.removeEventListener("pageshow", update);
    };
  }, [router]);

  const btn = "h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed";

  const handleBack = () => {
    if (!state.canBack) return;
    router.history.back();
    window.setTimeout(() => {
      const historyState = window.history.state as { idx?: number } | null;
      const idx = typeof historyState?.idx === "number" ? historyState.idx : Math.max(0, window.history.length - 1);
      const len = typeof window.history.length === "number" ? window.history.length : 1;
      setState({ canBack: idx > 0, canForward: idx < len - 1 });
    }, 0);
  };

  const handleForward = () => {
    if (!state.canForward) return;
    router.history.forward();
    window.setTimeout(() => {
      const historyState = window.history.state as { idx?: number } | null;
      const idx = typeof historyState?.idx === "number" ? historyState.idx : Math.max(0, window.history.length - 1);
      const len = typeof window.history.length === "number" ? window.history.length : 1;
      setState({ canBack: idx > 0, canForward: idx < len - 1 });
    }, 0);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={handleBack}
        disabled={!state.canBack}
        aria-label="Go back"
        className={btn}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleForward}
        disabled={!state.canForward}
        aria-label="Go forward"
        className={btn}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
