import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { TeacherDashboardContent } from "@/components/dashboards/teacher-dashboard-content";

export const Route = createFileRoute("/teacher-route")({
  head: () => ({ meta: [{ title: "Teacher Dashboard — Leatha" }] }),
  component: () => (
    <RequireAuth>
      <TeacherDashboardContent />
    </RequireAuth>
  ),
});