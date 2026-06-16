import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { StudentDashboardContent } from "@/components/dashboards/student-dashboard-content";

export const Route = createFileRoute("/student-route")({
  head: () => ({ meta: [{ title: "Student Dashboard — Leatha" }] }),
  component: () => (
    <RequireAuth>
      <StudentDashboardContent />
    </RequireAuth>
  ),
});