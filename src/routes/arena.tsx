import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ArenaNav } from "@/components/arena/arena-nav";

// Arena browsing is public; individual actions (submitting, battling) check for a user themselves.
export const Route = createFileRoute("/arena")({
  component: () => (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <ArenaNav />
      <Outlet />
    </div>
  ),
});
