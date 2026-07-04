import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/providers/auth-provider";

type RoleRouteGuardProps = {
  children: ReactNode;
  allowedAccountTypes: Array<"student" | "teacher" | "administrator">;
  fallbackPath?: string;
};

export function RoleRouteGuard({
  children,
  allowedAccountTypes,
  fallbackPath = "/dashboard-route",
}: RoleRouteGuardProps) {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user || !profile) return;

    if (!allowedAccountTypes.includes(profile.account_type)) {
      navigate({ to: fallbackPath, replace: true });
    }
  }, [allowedAccountTypes, fallbackPath, loading, navigate, profile, user]);

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  if (!allowedAccountTypes.includes(profile.account_type)) {
    return null;
  }

  return <>{children}</>;
}
