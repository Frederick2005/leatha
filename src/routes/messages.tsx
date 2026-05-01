import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import { formatDistanceToNow } from "date-fns";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — SkillChain" },
      { name: "description", content: "Your private conversations." },
    ],
  }),
  component: () => (<RequireAuth><MessagesLayout /></RequireAuth>),
});

interface ConvoPreview {
  otherId: string;
  otherProfile: { username: string; display_name: string | null; avatar_url: string | null } | null;
  lastBody: string;
  lastAt: string;
  unread: boolean;
  fromMe: boolean;
}

function MessagesLayout() {
  const { user, loading } = useAuth();
  const [convos, setConvos] = useState<ConvoPreview[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      setListLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(200);

      const seen = new Map<string, ConvoPreview>();
      for (const m of (data ?? []) as Array<{
        id: string; body: string; created_at: string; read_at: string | null;
        sender_id: string; recipient_id: string;
      }>) {
        const otherId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        if (seen.has(otherId)) continue;
        seen.set(otherId, {
          otherId,
          otherProfile: null,
          lastBody: m.body,
          lastAt: m.created_at,
          unread: m.recipient_id === user.id && !m.read_at,
          fromMe: m.sender_id === user.id,
        });
      }
      const ids = Array.from(seen.keys());
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", ids);
        (profs ?? []).forEach((p) => {
          const c = seen.get(p.id);
          if (c) c.otherProfile = { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url };
        });
      }
      if (cancelled) return;
      setConvos(Array.from(seen.values()));
      setListLoading(false);
    };
    void load();

    const channel = supabase
      .channel(`dm-list-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => void load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Sign in to view your messages.</p>
        <Link to="/auth" className="text-primary hover:underline mt-2 inline-block">Go to sign in</Link>
      </div>
    );
  }

  const isThread = location.pathname.startsWith("/messages/");
  const showList = !isThread; // mobile: hide list when in thread

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside
        className={cn(
          "border-r border-border w-full md:w-80 lg:w-96 flex-col bg-card",
          showList ? "flex" : "hidden md:flex",
        )}
      >
        <div className="px-4 py-4 border-b border-border flex items-center gap-2">
          <MessagesSquare className="h-5 w-5 text-primary" />
          <h1 className="font-display text-lg font-semibold">Chats</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {listLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {!listLoading && convos.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No conversations yet. Open someone's profile and send the first message.
            </div>
          )}
          {convos.map((c) => {
            const active = location.pathname === `/messages/${c.otherProfile?.username ?? ""}`;
            return (
              <Link
                key={c.otherId}
                to="/messages/$username"
                params={{ username: c.otherProfile?.username ?? "" }}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 border-b border-border/30 hover:bg-accent/50 transition-colors",
                  active && "bg-accent",
                )}
              >
                <UserAvatar
                  name={c.otherProfile?.display_name ?? c.otherProfile?.username}
                  url={c.otherProfile?.avatar_url}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-sm truncate">
                      {c.otherProfile?.display_name ?? c.otherProfile?.username ?? "unknown"}
                    </span>
                    <span className={cn("text-[11px] shrink-0", c.unread ? "text-primary font-semibold" : "text-muted-foreground")}>
                      {formatDistanceToNow(new Date(c.lastAt), { addSuffix: false })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className={cn(
                      "text-xs truncate flex-1",
                      c.unread ? "text-foreground font-medium" : "text-muted-foreground",
                    )}>
                      {c.fromMe && "✓ "}{c.lastBody || "📎 attachment"}
                    </p>
                    {c.unread && <span className="h-5 min-w-5 px-1.5 grid place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shrink-0">•</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </aside>

      <section className={cn("flex-1 min-w-0", isThread ? "flex" : "hidden md:flex")}>
        {isThread ? (
          <Outlet />
        ) : (
          <div className="flex-1 grid place-items-center text-sm text-muted-foreground bg-muted/20">
            <div className="text-center">
              <MessagesSquare className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="mt-3">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

