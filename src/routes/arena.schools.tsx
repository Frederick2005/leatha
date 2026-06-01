import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/arena/schools")({ component: SchoolsArena });

function SchoolsArena() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-center">
      <BarChart3 className="h-12 w-12 mx-auto text-primary" />
      <h1 className="font-display text-2xl font-bold mt-3">School Competition</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Seasonal rankings, school banners, and inter-school events open in Phase 3. The scaffolding is ready.
      </p>
      <div className="mt-6 rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
        Once your school accumulates solves from at least 5 students this season, it will appear here ranked against others.
      </div>
    </div>
  );
}
