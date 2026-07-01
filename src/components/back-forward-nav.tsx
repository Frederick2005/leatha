import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Persistent Back/Forward buttons — useful in PWA/desktop shells where the
 * browser chrome is not visible. Tracks its own idx by observing router
 * subscriptions so we can grey out disabled directions.
 */
export function BackForwardNav({ className }: { className?: string }) {
  const router = useRouter();
  const [state, setState] = useState({ canBack: false, canForward: false });

  useEffect(() => {
    const update = () => {
      const h = (router.history as any);
      const idx = typeof h.index === "number" ? h.index : (window.history.state?.idx ?? 0);
      const len = h.length ?? window.history.length ?? 1;
      setState({ canBack: idx > 0, canForward: idx < len - 1 });
    };
    update();
    const unsub = router.subscribe("onLoad", update);
    window.addEventListener("popstate", update);
    return () => { unsub?.(); window.removeEventListener("popstate", update); };
  }, [router]);

  const btn = "h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={() => window.history.back()}
        disabled={!state.canBack}
        aria-label="Go back"
        className={btn}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => window.history.forward()}
        disabled={!state.canForward}
        aria-label="Go forward"
        className={btn}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
