import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Send, Trash2, MessageSquare } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Public Chat — SkillChain" },
      { name: "description", content: "Live community chat for SkillChain learners." },
    ],
  }),
  component: () => (<RequireAuth><ChatPage /></RequireAuth>),
});

interface ChatRow {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
  author?: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

function ChatPage() {
  const { user, profile, isModOrAdmin } = useAuth();
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const profileCache = useRef<Map<string, ChatRow["author"]>>(new Map());

  const hydrate = async (rows: { author_id: string }[]) => {
    const ids = Array.from(new Set(rows.map((r) => r.author_id))).filter(
      (id) => !profileCache.current.has(id),
    );
    if (ids.length === 0) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids);
    (data ?? []).forEach((p) => {
      profileCache.current.set(p.id, {
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      });
    });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      const rows = (data ?? []).reverse() as ChatRow[];
      await hydrate(rows);
      if (cancelled) return;
      setMessages(rows.map((r) => ({ ...r, author: profileCache.current.get(r.author_id) ?? null })));
      setLoading(false);
    })();

    const channel = supabase
      .channel("chat-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const row = payload.new as ChatRow;
          await hydrate([row]);
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, { ...row, author: profileCache.current.get(row.author_id) ?? null }];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          const old = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!user || !body.trim() || sending) return;
    setSending(true);
    const text = body.trim().slice(0, 2000);
    const { error } = await supabase
      .from("chat_messages")
      .insert({ author_id: user.id, body: text });
    setSending(false);
    if (error) toast.error(error.message);
    else setBody("");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="border-b border-border px-6 py-4 bg-background/70 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-lg font-semibold">
              <MessageSquare className="h-5 w-5 text-primary" />
              Public chat
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Live community room for learners and teachers. Be curious and kind.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{messages.length} messages</span>
            <span>Press Enter to send</span>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && messages.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-12">
            No messages yet. Say hi 👋
          </div>
        )}
        {messages.map((m) => {
          const mine = user?.id === m.author_id;
          const canDelete = mine || isModOrAdmin;
          return (
            <div
              key={m.id}
              className={
                mine
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div className={
                `relative max-w-[90%] ${mine ? "rounded-bl-3xl rounded-tl-3xl rounded-tr-3xl bg-primary/10 text-foreground" : "rounded-br-3xl rounded-tr-3xl rounded-tl-3xl bg-surface border border-border text-foreground"}`
              }>
                <div className="flex items-center gap-2 px-3 pt-3">
                  {!mine && (
                    <Link to="/u/$username" params={{ username: m.author?.username ?? "" }} className="shrink-0">
                      <UserAvatar name={m.author?.display_name ?? m.author?.username} url={m.author?.avatar_url} size="sm" />
                    </Link>
                  )}
                  <div className="flex flex-col">
                    <div className="text-sm font-medium">
                      {mine ? "You" : m.author?.display_name ?? m.author?.username ?? "Unknown"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <div className="px-3 pb-3 pt-2 text-sm whitespace-pre-wrap break-words">
                  {m.body}
                </div>
                {canDelete && (
                  <button
                    onClick={() => remove(m.id)}
                    className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    aria-label="Delete message"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border bg-surface/50 p-3 sm:p-4">
        {user ? (
          <div className="flex items-end gap-2">
            <UserAvatar
              name={profile?.display_name ?? profile?.username}
              url={profile?.avatar_url}
              size="sm"
            />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Message the room…"
              className="resize-none min-h-[44px] max-h-32"
              rows={1}
              maxLength={2000}
            />
            <Button onClick={send} disabled={!body.trim() || sending} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center">
            <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to join the conversation.
          </div>
        )}
      </div>
    </div>
  );
}
