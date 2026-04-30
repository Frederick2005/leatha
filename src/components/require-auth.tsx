import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/providers/auth-provider";

/**
 * Wrap any route component with this to require an authenticated user.
 * If signed-out, redirects to /auth and replaces history so back-button
 * cannot return to protected content.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const currentPath = typeof window === "undefined" ? "/" : window.location.pathname;
  const currentSearch = typeof window === "undefined" ? "" : window.location.search;
  const isAuthRoute = currentPath.startsWith("/auth");
  const redirectPath = `${currentPath}${currentSearch}`;

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthRoute) {
      navigate({
        to: "/auth",
        search: { redirect: redirectPath },
        replace: true,
      });
    }
  }, [user, loading, navigate, isAuthRoute, redirectPath]);

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
