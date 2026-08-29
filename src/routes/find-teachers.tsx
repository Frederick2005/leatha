import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";
import { UserAvatar } from "@/components/user-avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookingModal, type TeacherWithProfile } from "@/components/booking-modal";
import { Search, Star, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/find-teachers")({
  head: () => ({ meta: [{ title: "Find Teachers — Leatha" }] }),
  component: () => (
    <RequireAuth>
      <FindTeachersPage />
    </RequireAuth>
  ),
});

type SortKey = "rating" | "price_low" | "price_high" | "experience";

function FindTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("rating");
  const [bookingTeacher, setBookingTeacher] = useState<TeacherWithProfile | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: profiles, error } = await supabase
        .from("teacher_profiles")
        .select(
          "user_id, subjects, hourly_rate_cents, years_experience, rating_avg, rating_count, accepts_bookings",
        )
        .eq("accepts_bookings", true);

      if (error) {
        toast.error("Couldn't load teachers: " + error.message);
        setTeachers([]);
        setLoading(false);
        return;
      }

      if (!profiles || profiles.length === 0) {
        setTeachers([]);
        setLoading(false);
        return;
      }

      const ids = profiles.map((p) => p.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, school")
        .in("id", ids);

      const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
      setTeachers(
        profiles.map((p) => ({
          ...p,
          hourly_rate: p.hourly_rate_cents / 100,
          profile: byId[p.user_id],
        })) as TeacherWithProfile[],
      );
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    teachers.forEach((t) => t.subjects.forEach((s) => (counts[s] = (counts[s] ?? 0) + 1)));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [teachers]);

  const filtered = useMemo(() => {
    let list = teachers;

    if (category !== "all") {
      list = list.filter((t) => t.subjects.includes(category));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.profile?.display_name?.toLowerCase().includes(q) ||
          t.profile?.username.toLowerCase().includes(q) ||
          t.subjects.some((s) => s.toLowerCase().includes(q)),
      );
    }

    const sorted = [...list];
    if (sortBy === "rating") sorted.sort((a, b) => b.rating_avg - a.rating_avg);
    if (sortBy === "price_low") sorted.sort((a, b) => a.hourly_rate - b.hourly_rate);
    if (sortBy === "price_high") sorted.sort((a, b) => b.hourly_rate - a.hourly_rate);
    if (sortBy === "experience")
      sorted.sort((a, b) => Number(b.years_experience) - Number(a.years_experience));
    return sorted;
  }, [teachers, category, search, sortBy]);

  return (
    <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Find Teachers</h1>
        <p className="text-sm text-muted-foreground">Browse verified teachers and book a session.</p>
      </div>

      {/* Search + sort */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or subject"
            className="pl-9"
          />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-10 rounded-md border border-border bg-background pl-9 pr-3 text-sm appearance-none"
          >
            <option value="rating">Highest rated</option>
            <option value="price_low">Price: low to high</option>
            <option value="price_high">Price: high to low</option>
            <option value="experience">Most experienced</option>
          </select>
          <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => setCategory("all")}
          className={cn(
            "shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors",
            category === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:border-primary/40",
          )}
        >
          All ({teachers.length})
        </button>
        {categories.map(([name, count]) => (
          <button
            key={name}
            onClick={() => setCategory(name)}
            className={cn(
              "shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors",
              category === name
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {name} ({count})
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-40 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No teachers match your filters yet. Try a different subject or check back soon.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((t) => (
            <div key={t.user_id} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={t.profile?.display_name ?? t.profile?.username ?? "T"}
                  url={t.profile?.avatar_url}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {t.profile?.display_name ?? t.profile?.username}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.profile?.school ?? "Independent tutor"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {t.subjects.slice(0, 3).map((s) => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {s}
                  </span>
                ))}
                {t.subjects.length > 3 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    +{t.subjects.length - 3} more
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-amber-500">
                  <Star className="h-3.5 w-3.5 fill-amber-500" />
                  {t.rating_avg?.toFixed(1) ?? "New"} {t.rating_count > 0 && `(${t.rating_count})`}
                </span>
                <span className="text-muted-foreground">
                  {Number(t.years_experience) > 0 ? `${t.years_experience} yrs exp` : "New teacher"}
                </span>
              </div>

              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-bold">
                  {t.hourly_rate > 0 ? `UGX ${t.hourly_rate.toLocaleString()}/hr` : "Rate not set"}
                </span>
                <Button size="sm" onClick={() => setBookingTeacher(t)} disabled={t.hourly_rate === 0}>
                  Book
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {bookingTeacher && (
        <BookingModal
          teacher={bookingTeacher}
          open={!!bookingTeacher}
          onClose={() => setBookingTeacher(null)}
        />
      )}
    </div>
  );
}