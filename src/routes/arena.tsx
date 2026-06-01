import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ArenaNav } from "@/components/arena/arena-nav";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/arena")({
  component: () => (
    <RequireAuth>
      <div className="min-h-[calc(100vh-3.5rem)]">
        <ArenaNav />
        <Outlet />
      </div>
    </RequireAuth>
  ),
});
