import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Calendar, MessageCircle as MsgIcon, GitFork } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LessonFeedCard } from "./index";
import { timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/u/$username")({
  component: ProfilePage,
});

interface ProfileFull {
  id: string; username: string; display_name: string | null; bio: string | null; avatar_url: string | null;
  points: number; lesson_count: number; fork_received_count: number;
  follower_count: number; following_count: number; created_at: string;
}

interface FeedLesson {
  id: string; title: string; slug: string; summary: string | null; tags: string[];
  fork_count: number; like_count: number; comment_count: number; created_at: string;
  parent_lesson_id: string | null;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
}

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<ProfileFull | null>(null);
  const [lessons, setLessons] = useState<FeedLesson[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"lessons" | "followers" | "following">("lessons");
  const [followers, setFollowers] = useState<ProfileFull[]>([]);
  const [followingList, setFollowingList] = useState<ProfileFull[]>([]);

  const reload = async () => {
    const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
    if (!p) { setLoading(false); return; }
    setProfile(p as ProfileFull);
    const { data: ls } = await supabase
      .from("lessons")
      .select(`id, title, slug, summary, tags, fork_count, like_count, comment_count, created_at, parent_lesson_id,
               author:profiles!lessons_author_id_fkey(id, username, display_name, avatar_url)`)
      .eq("author_id", p.id).eq("is_published", true).order("created_at", { ascending: false }).limit(50);
    setLessons((ls as unknown as FeedLesson[]) ?? []);
    if (user && user.id !== p.id) {
      const { data: f } = await supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("followee_id", p.id).maybeSingle();
      setFollowing(!!f);
    }
    setLoading(false);
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [username, user?.id]);

  useEffect(() => {
    if (!profile) return;
    if (tab === "followers") {
      void supabase.from("follows").select("profile:profiles!follows_follower_id_fkey(*)").eq("followee_id", profile.id)
        .then(({ data }) => setFollowers(((data ?? []) as unknown as { profile: ProfileFull }[]).map((r) => r.profile).filter(Boolean)));
    } else if (tab === "following") {
      void supabase.from("follows").select("profile:profiles!follows_followee_id_fkey(*)").eq("follower_id", profile.id)
        .then(({ data }) => setFollowingList(((data ?? []) as unknown as { profile: ProfileFull }[]).map((r) => r.profile).filter(Boolean)));
    }
  }, [tab, profile]);

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

  if (loading) return <div className="p-10"><div className="h-40 rounded-lg bg-muted animate-pulse max-w-3xl mx-auto" /></div>;
  if (!profile) return <div className="p-10 text-center text-muted-foreground">User @{username} not found.</div>;

  const isMe = user?.id === profile.id;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col sm:flex-row gap-5 items-start">
        <UserAvatar name={profile.display_name ?? profile.username} url={profile.avatar_url} size="xl" />
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold">{profile.display_name ?? profile.username}</h1>
          <p className="text-sm font-mono text-muted-foreground">@{profile.username}</p>
          {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-primary" /><strong className="text-foreground">{profile.points}</strong> pts</span>
            <span><strong className="text-foreground">{profile.lesson_count}</strong> lessons</span>
            <span className="inline-flex items-center gap-1"><GitFork className="h-3.5 w-3.5" /><strong className="text-foreground">{profile.fork_received_count}</strong> forks received</span>
            <span><strong className="text-foreground">{profile.follower_count}</strong> followers</span>
            <span><strong className="text-foreground">{profile.following_count}</strong> following</span>
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> joined {timeAgo(profile.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
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
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="lessons">Lessons ({profile.lesson_count})</TabsTrigger>
          <TabsTrigger value="followers">Followers ({profile.follower_count})</TabsTrigger>
          <TabsTrigger value="following">Following ({profile.following_count})</TabsTrigger>
        </TabsList>
        <TabsContent value="lessons" className="mt-4 space-y-3">
          {lessons.length === 0 ? <p className="text-muted-foreground text-sm">No lessons yet.</p> : lessons.map((l) => <LessonFeedCard key={l.id} lesson={l} />)}
        </TabsContent>
        <TabsContent value="followers" className="mt-4">
          <UserList profiles={followers} />
        </TabsContent>
        <TabsContent value="following" className="mt-4">
          <UserList profiles={followingList} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserList({ profiles }: { profiles: ProfileFull[] }) {
  if (profiles.length === 0) return <p className="text-muted-foreground text-sm">Nobody yet.</p>;
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {profiles.map((p) => (
        <Link key={p.id} to="/u/$username" params={{ username: p.username }} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/40">
          <UserAvatar name={p.display_name ?? p.username} url={p.avatar_url} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{p.display_name ?? p.username}</p>
            <p className="text-xs font-mono text-muted-foreground truncate">@{p.username} · {p.points} pts</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
