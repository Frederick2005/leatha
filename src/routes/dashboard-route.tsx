import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { StudentDashboardContent } from "@/components/dashboards/student-dashboard-content";
import { TeacherDashboardContent } from "@/components/dashboards/teacher-dashboard-content";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/dashboard-route")({
  head: () => ({ meta: [{ title: "Dashboard — Leatha" }] }),
  component: () => (
    <RequireAuth>
      <DashboardRouter />
    </RequireAuth>
  ),
});

type AdminView = "teacher" | "student";

function DashboardRouter() {
  const { profile, isSuperAdmin, isAdmin, loading } = useAuth();
  const [adminView, setAdminView] = useState<AdminView>("teacher");

  if (loading || !profile) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const isPrivileged = isSuperAdmin || isAdmin || profile.account_type === "administrator";

  // ── Admin / Super admin: preview both dashboard types ──
  if (isPrivileged) {
    return (
      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin preview — this shows dashboard layouts, not platform-wide data
          </div>
          <div className="flex gap-1 rounded-full border border-border bg-card p-1">
            <button
              onClick={() => setAdminView("teacher")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full transition-colors",
                adminView === "teacher"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Teacher View
            </button>
            <button
              onClick={() => setAdminView("student")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full transition-colors",
                adminView === "student"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Student View
            </button>
          </div>
        </div>
        {adminView === "teacher" ? <TeacherDashboardContent /> : <StudentDashboardContent />}
      </div>
    );
  }

  // ── Regular teacher ──
  if (profile.account_type === "teacher") {
    return <TeacherDashboardContent />;
  }

  // ── Default: student ──
  return <StudentDashboardContent />;
}