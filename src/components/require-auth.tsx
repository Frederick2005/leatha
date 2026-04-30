import { useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/providers/auth-provider";

/**
 * Wrap any route component with this to require an authenticated user.
 * If signed-out, redirects to /auth and replaces history so back-button
 * cannot return to protected content.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthRoute = location.pathname.startsWith("/auth");
  const redirectPath =
    typeof window === "undefined"
      ? location.pathname
      : `${window.location.pathname}${window.location.search}`;

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
