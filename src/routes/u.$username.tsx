import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Trophy, Calendar, MessageCircle as MsgIcon, GitFork, BadgeCheck, GraduationCap,
  BookOpen, MapPin, Star, Flame, Target, Award, Share2, Eye, Zap, Briefcase, Heart,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LessonFeedCard } from "@/components/lesson-feed-card";
import { RequireAuth } from "@/components/require-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/u/$username")({
  component: () => (<RequireAuth><ProfilePage /></RequireAuth>),
});

interface ProfileFull {
  id: string; username: string; display_name: string | null; bio: string | null;
  avatar_url: string | null; cover_url: string | null;
  account_type: "student" | "teacher" | "administrator";
  school: string | null; grade: string | null; experience: string | null;
  subjects: string[] | null; interests: string[] | null; location: string | null;
  teaching_philosophy: string | null; certifications: string[] | null;
  is_verified: boolean; xp: number; level: number; streak_days: number;
  points: number; lesson_count: number; fork_received_count: number;
  follower_count: number; following_count: number; created_at: string;
}

interface FeedLesson {
  id: string; title: string; slug: string; summary: string | null; tags: string[];
  fork_count: number; like_count: number; comment_count: number; view_count?: number;
  created_at: string; parent_lesson_id: string | null;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
}

function ProfilePage() {
  const { username } = Route.useParams();
  const { user, profile: meProfile } = useAuth();

  const [profile, setProfile] = useState<ProfileFull | null>(null);
  const [lessons, setLessons] = useState<FeedLesson[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [arenaStats, setArenaStats] = useState<{ solves: number; attempts: number; streak: number; xp: number; subjects: Record<string, { ok: number; total: number }> }>({ solves: 0, attempts: 0, streak: 0, xp: 0, subjects: {} });
  const [endorsements, setEndorsements] = useState<{ id: string; body: string; teacher_id: string; created_at: string; teacher: { username: string; display_name: string | null; avatar_url: string | null } | null }[]>([]);
  const [createdChallenges, setCreatedChallenges] = useState<{ id: string; title: string; difficulty: string; slug: string; solve_count: number }[]>([]);

  const reload = async () => {
    const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
    if (!p) { setLoading(false); return; }
    setProfile(p as ProfileFull);

    const [{ data: ls }, follow, attempts, end, ch] = await Promise.all([
      supabase.from("lessons")
        .select(`id, title, slug, summary, tags, fork_count, like_count, comment_count, view_count, created_at, parent_lesson_id,
                 author:profiles!lessons_author_profile_fkey(id, username, display_name, avatar_url)`)
        .eq("author_id", p.id).eq("is_published", true).order("created_at", { ascending: false }).limit(50),
      user && user.id !== p.id
        ? supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("followee_id", p.id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("arena_attempts")
        .select("status, arena_challenges(subject)")
        .eq("user_id", p.id),
      supabase.from("endorsements")
        .select("id, body, teacher_id, created_at, teacher:profiles!endorsements_teacher_id_fkey(username, display_name, avatar_url)")
        .eq("student_id", p.id).order("created_at", { ascending: false }).limit(10),
      (p as ProfileFull).account_type === "teacher"
        ? supabase.from("arena_challenges").select("id, title, difficulty, slug, solve_count").eq("creator_id", p.id).eq("status", "published").limit(20)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string; difficulty: string; slug: string; solve_count: number }> }),
    ]);

    setLessons((ls as unknown as FeedLesson[]) ?? []);
    setFollowing(!!(follow as { data: unknown }).data);

    const rows = (attempts.data ?? []) as unknown as Array<{ status: string; arena_challenges: { tags: string[] | null } | null }>;
    const subjects: Record<string, { ok: number; total: number }> = {};
    let solves = 0;
    for (const r of rows) {
      const subj = r.arena_challenges?.tags?.[0] ?? "Other";
      subjects[subj] ??= { ok: 0, total: 0 };
      subjects[subj].total++;
      if (r.status === "passed") { subjects[subj].ok++; solves++; }
    }
    const { data: ap } = await supabase.from("arena_profiles").select("xp, streak").eq("user_id", p.id).maybeSingle();
    setArenaStats({ solves, attempts: rows.length, streak: ap?.streak ?? 0, xp: ap?.xp ?? 0, subjects });

    setEndorsements((end.data ?? []) as never);
    setCreatedChallenges(((ch as { data: unknown }).data ?? []) as never);
    setLoading(false);
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [username, user?.id]);

  const toggleFollow = async () => {
    if (!user) { toast.error("Sign in to follow"); return; }
    if (!profile) return;
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("followee_id", profile.id);
      setFollowing(false);
      setProfile({ ...profile, follower_count: Math.max(0, profile.follower_count - 1) });
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, followee_id: profile.id });
      setFollowing(true);
      setProfile({ ...profile, follower_count: profile.follower_count + 1 });
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/u/${profile?.username}`;
    if (navigator.share) {
      try { await navigator.share({ title: profile?.display_name ?? profile?.username, url }); } catch { /* noop */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    }
  };

  const endorse = async () => {
    if (!user || !profile) return;
    const body = window.prompt("Write your endorsement (visible publicly):");
    if (!body || body.trim().length < 5) return;
    const { error } = await supabase.from("endorsements").insert({ teacher_id: user.id, student_id: profile.id, body: body.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("Endorsement posted");
    void reload();
  };

  if (loading) return <div className="p-10"><div className="h-64 rounded-2xl bg-muted animate-pulse max-w-4xl mx-auto" /></div>;
  if (!profile) return <div className="p-10 text-center text-muted-foreground">User @{username} not found.</div>;

  const isMe = user?.id === profile.id;
  const isTeacher = profile.account_type === "teacher";
  const isStudent = profile.account_type === "student";
  const meIsTeacher = meProfile?.account_type === "teacher";
  const subjectList = (profile.subjects && profile.subjects.length ? profile.subjects : profile.interests) ?? [];
  const rankTitle = computeRankTitle(arenaStats.xp);
  const accuracy = arenaStats.attempts ? Math.round((arenaStats.solves / arenaStats.attempts) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Cover banner */}
      <div className={cn(
        "h-40 sm:h-56 w-full relative",
        isTeacher ? "bg-gradient-to-br from-emerald-500/30 via-primary/20 to-purple-500/20"
          : "bg-gradient-to-br from-sky-500/30 via-primary/20 to-pink-500/20",
      )} style={profile.cover_url ? { backgroundImage: `url(${profile.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="px-4 -mt-16 sm:-mt-20 relative">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="-mt-12 sm:-mt-16">
              <div className="rounded-full ring-4 ring-card inline-block">
                <UserAvatar name={profile.display_name ?? profile.username} url={profile.avatar_url} size="xl" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-display font-bold">{profile.display_name ?? profile.username}</h1>
                {isTeacher && (
                  <Badge variant="secondary" className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/20">
                    <GraduationCap className="h-3 w-3" /> Teacher
                  </Badge>
                )}
                {isStudent && (
                  <Badge variant="secondary" className="gap-1 bg-sky-500/15 text-sky-600 border-sky-500/20">
                    <BookOpen className="h-3 w-3" /> Student
                  </Badge>
                )}
                {profile.is_verified && (
                  <Badge className="gap-1 bg-blue-500 hover:bg-blue-500/90 text-white">
                    <BadgeCheck className="h-3 w-3" /> Verified
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground font-mono mt-0.5">@{profile.username}</div>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                {profile.school && <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {profile.school}</span>}
                {profile.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {profile.location}</span>}
                {isStudent && rankTitle && (
                  <span className="inline-flex items-center gap-1 text-primary"><Trophy className="h-3.5 w-3.5" /> {rankTitle}</span>
                )}
              </div>
              {profile.bio && <p className="mt-3 text-sm leading-relaxed">{profile.bio}</p>}

              {subjectList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {subjectList.slice(0, 10).map((s) => (
                    <span key={s} className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{s}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-row sm:flex-col gap-2">
              {isMe ? (
                <Button asChild variant="outline" size="sm"><Link to="/settings">Edit profile</Link></Button>
              ) : user ? (
                <>
                  <Button onClick={toggleFollow} variant={following ? "outline" : "default"} size="sm">
                    {following ? "Following" : "Follow"}
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/messages/$username" params={{ username: profile.username }}>
                      <MsgIcon className="h-4 w-4 mr-1.5" /> Message
                    </Link>
                  </Button>
                </>
              ) : null}
              <Button onClick={share} variant="ghost" size="sm">
                <Share2 className="h-4 w-4 mr-1.5" /> Share
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
            {isTeacher ? (
              <>
                <Stat icon={<BookOpen className="h-4 w-4" />} value={profile.lesson_count} label="Lessons" />
                <Stat icon={<GitFork className="h-4 w-4" />} value={profile.fork_received_count} label="Forks received" />
                <Stat icon={<Heart className="h-4 w-4" />} value={profile.follower_count} label="Followers" />
                <Stat icon={<Trophy className="h-4 w-4 text-primary" />} value={profile.points} label="Reputation" />
              </>
            ) : (
              <>
                <Stat icon={<Trophy className="h-4 w-4 text-primary" />} value={profile.points} label="Points" />
                <Stat icon={<Target className="h-4 w-4" />} value={arenaStats.solves} label="Solved" />
                <Stat icon={<Flame className="h-4 w-4 text-orange-500" />} value={arenaStats.streak} label="Streak" />
                <Stat icon={<Heart className="h-4 w-4" />} value={profile.follower_count} label="Followers" />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 mt-6">
        <Tabs defaultValue={isTeacher ? "lessons" : "activity"}>
          <TabsList className="flex-wrap h-auto">
            {isTeacher && <TabsTrigger value="lessons">Lessons ({profile.lesson_count})</TabsTrigger>}
            {isTeacher && <TabsTrigger value="challenges">Challenges</TabsTrigger>}
            {isStudent && <TabsTrigger value="activity">Activity</TabsTrigger>}
            {isStudent && <TabsTrigger value="arena">Arena</TabsTrigger>}
            {isStudent && <TabsTrigger value="endorsements">Endorsements</TabsTrigger>}
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          {isTeacher && (
            <TabsContent value="lessons" className="mt-4 space-y-3">
              {lessons.length === 0 ? <EmptyTab text="No lessons yet." /> : lessons.map((l) => <LessonFeedCard key={l.id} lesson={l} />)}
            </TabsContent>
          )}

          {isTeacher && (
            <TabsContent value="challenges" className="mt-4">
              {createdChallenges.length === 0 ? <EmptyTab text="No challenges created yet." /> : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {createdChallenges.map((c) => (
                    <Link key={c.id} to="/arena/challenges/$slug" params={{ slug: c.slug }}
                      className="rounded-lg border border-border bg-card p-4 hover:border-primary/40">
                      <div className="font-medium truncate">{c.title}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <Badge variant="outline" className="capitalize">{c.difficulty}</Badge>
                        <span className="inline-flex items-center gap-1"><Target className="h-3 w-3" /> {c.solve_count} solves</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {isStudent && (
            <TabsContent value="activity" className="mt-4 space-y-3">
              {lessons.length === 0 ? <EmptyTab text="No public activity yet." /> : lessons.map((l) => <LessonFeedCard key={l.id} lesson={l} />)}
            </TabsContent>
          )}

          {isStudent && (
            <TabsContent value="arena" className="mt-4 space-y-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground font-mono uppercase">Arena rank</div>
                    <div className="font-display text-2xl font-bold mt-0.5">{rankTitle ?? "Unranked"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground font-mono uppercase">XP</div>
                    <div className="font-display text-2xl font-bold text-primary">{arenaStats.xp}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
                  <Stat icon={<Target className="h-4 w-4" />} value={arenaStats.solves} label="Solved" />
                  <Stat icon={<Zap className="h-4 w-4 text-yellow-500" />} value={accuracy} label="Accuracy %" />
                  <Stat icon={<Flame className="h-4 w-4 text-orange-500" />} value={arenaStats.streak} label="Streak" />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-display font-semibold mb-3">Subject mastery</h3>
                {Object.keys(arenaStats.subjects).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attempts yet.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(arenaStats.subjects)
                      .sort(([, a], [, b]) => b.ok - a.ok)
                      .slice(0, 5)
                      .map(([subj, v]) => {
                        const pct = v.total ? Math.round((v.ok / v.total) * 100) : 0;
                        return (
                          <div key={subj}>
                            <div className="flex justify-between text-xs mb-1"><span>{subj}</span><span className="text-muted-foreground">{v.ok}/{v.total}</span></div>
                            <Progress value={pct} className="h-2" />
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {isStudent && (
            <TabsContent value="endorsements" className="mt-4 space-y-3">
              {meIsTeacher && !isMe && (
                <Button onClick={endorse} size="sm" variant="outline" className="gap-2">
                  <Award className="h-4 w-4" /> Endorse this student
                </Button>
              )}
              {endorsements.length === 0 ? <EmptyTab text="No endorsements yet." /> : (
                endorsements.map((e) => (
                  <div key={e.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserAvatar name={e.teacher?.display_name ?? e.teacher?.username} url={e.teacher?.avatar_url ?? null} size="sm" />
                      <div className="min-w-0">
                        <Link to="/u/$username" params={{ username: e.teacher?.username ?? "" }} className="font-medium text-sm hover:underline">
                          {e.teacher?.display_name ?? e.teacher?.username}
                        </Link>
                        <div className="text-[10px] font-mono text-muted-foreground">{format(new Date(e.created_at), "MMM d, yyyy")}</div>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed">{e.body}</p>
                  </div>
                ))
              )}
            </TabsContent>
          )}

          <TabsContent value="about" className="mt-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              {isTeacher && profile.experience && <InfoRow label="Experience" value={profile.experience} />}
              {isStudent && profile.grade && <InfoRow label="Grade" value={profile.grade} />}
              {profile.school && <InfoRow label={isTeacher ? "Teaches at" : "School"} value={profile.school} />}
              {subjectList.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground font-mono uppercase mb-1">{isTeacher ? "Subjects taught" : "Subjects of interest"}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {subjectList.map((s) => (
                      <span key={s} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {profile.teaching_philosophy && <InfoRow label="Teaching philosophy" value={profile.teaching_philosophy} />}
              {profile.certifications && profile.certifications.length > 0 && (
                <InfoRow label="Certifications" value={profile.certifications.join(", ")} />
              )}
              <InfoRow label="Member since" value={format(new Date(profile.created_at), "MMMM yyyy")} icon={<Calendar className="h-3 w-3" />} />
              {isTeacher && (
                <div className={cn("rounded-lg p-3 text-sm flex gap-2", profile.is_verified ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-amber-500/10 border border-amber-500/20")}>
                  <BadgeCheck className={cn("h-4 w-4 shrink-0 mt-0.5", profile.is_verified ? "text-emerald-500" : "text-amber-500")} />
                  <div>
                    {profile.is_verified ? (
                      <>
                        <div className="font-semibold">Verified by Leatha</div>
                        <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <li>✓ Identity and qualifications verified</li>
                          <li>✓ School employment confirmed</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <div className="font-semibold">Not yet verified</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          This teacher has not yet completed verification. Content is not officially endorsed by Leatha.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-lg font-semibold">{icon}{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground font-mono uppercase mb-0.5 inline-flex items-center gap-1">{icon}{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function EmptyTab({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-10">{text}</p>;
}

function computeRankTitle(xp: number): string | null {
  if (xp <= 0) return null;
  if (xp < 100) return "Learner";
  if (xp < 500) return "Scholar";
  if (xp < 1500) return "Thinker";
  if (xp < 5000) return "Challenger";
  if (xp < 15000) return "Master Scholar";
  return "Grandmaster";
}
