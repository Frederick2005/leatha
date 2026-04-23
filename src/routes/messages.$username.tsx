import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Send, ArrowLeft, Ban, ShieldOff, Paperclip, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DmAttachment, type AttachmentMeta } from "@/components/dm-attachment";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_FILES = 5;

export const Route = createFileRoute("/messages/$username")({
  component: ThreadPage,
});

interface DM {
  id: string;
  body: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  read_at: string | null;
  attachments: AttachmentMeta[];
}

interface OtherProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

function ThreadPage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [other, setOther] = useState<OtherProfile | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("username", username)
        .maybeSingle();

      if (!prof || cancelled) {
        setLoading(false);
        return;
      }
      setOther(prof as OtherProfile);

      const [{ data: msgs }, { data: blocks }] = await Promise.all([
        supabase
          .from("direct_messages")
          .select("*")
          .or(
            `and(sender_id.eq.${user.id},recipient_id.eq.${prof.id}),and(sender_id.eq.${prof.id},recipient_id.eq.${user.id})`,
          )
          .order("created_at", { ascending: true })
          .limit(500),
        supabase
          .from("blocks")
          .select("blocker_id, blocked_id")
          .or(
            `and(blocker_id.eq.${user.id},blocked_id.eq.${prof.id}),and(blocker_id.eq.${prof.id},blocked_id.eq.${user.id})`,
          ),
      ]);
      if (cancelled) return;
      setMessages((msgs ?? []) as unknown as DM[]);

      // blocks RLS only returns my own rows; we'll detect mine vs theirs heuristically
      const myBlocks = (blocks ?? []) as { blocker_id: string; blocked_id: string }[];
      setBlocked(myBlocks.some((b) => b.blocker_id === user.id && b.blocked_id === prof.id));
      // We can't see if they blocked us due to RLS — sends will just fail silently for them.
      setBlockedByOther(false);

      // mark unread messages from them as read
      const unreadIds = (msgs ?? [])
        .filter((m) => m.recipient_id === user.id && !m.read_at)
        .map((m) => m.id);
      if (unreadIds.length) {
        await supabase
          .from("direct_messages")
          .update({ read_at: new Date().toISOString() })
          .in("id", unreadIds);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, username]);

  useEffect(() => {
    if (!user || !other) return;
    const channel = supabase
      .channel(`dm-${user.id}-${other.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = payload.new as DM;
          const involves =
            (row.sender_id === user.id && row.recipient_id === other.id) ||
            (row.sender_id === other.id && row.recipient_id === user.id);
          if (!involves) return;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          if (row.recipient_id === user.id) {
            void supabase
              .from("direct_messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", row.id);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, other]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const next = [...pendingFiles];
    for (const f of incoming) {
      if (next.length >= MAX_FILES) {
        toast.error(`Max ${MAX_FILES} files per message`);
        break;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name} exceeds 20 MB`);
        continue;
      }
      next.push(f);
    }
    setPendingFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePending = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const send = async () => {
    if (!user || !other || sending) return;
    const text = body.trim().slice(0, 4000);
    if (!text && pendingFiles.length === 0) return;
    setSending(true);

    let uploaded: AttachmentMeta[] = [];
    if (pendingFiles.length) {
      setUploading(true);
      try {
        uploaded = await Promise.all(
          pendingFiles.map(async (file) => {
            const safeName = file.name.replace(/[^\w.\-]+/g, "_");
            const path = `${user.id}/${other.id}/${crypto.randomUUID()}-${safeName}`;
            const { error: upErr } = await supabase.storage
              .from("dm-attachments")
              .upload(path, file, { contentType: file.type, upsert: false });
            if (upErr) throw upErr;
            return {
              path,
              name: file.name,
              size: file.size,
              type: file.type || "application/octet-stream",
            };
          }),
        );
      } catch (e) {
        setUploading(false);
        setSending(false);
        toast.error(e instanceof Error ? e.message : "Upload failed");
        return;
      }
      setUploading(false);
    }

    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id,
      recipient_id: other.id,
      body: text,
      attachments: uploaded as unknown as never,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
    } else {
      setBody("");
      setPendingFiles([]);
    }
  };

  const toggleBlock = async () => {
    if (!user || !other) return;
    if (blocked) {
      const { error } = await supabase
        .from("blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", other.id);
      if (error) return toast.error(error.message);
      setBlocked(false);
      toast.success("User unblocked");
    } else {
      const { error } = await supabase
        .from("blocks")
        .insert({ blocker_id: user.id, blocked_id: other.id });
      if (error) return toast.error(error.message);
      setBlocked(true);
      toast.success("User blocked");
    }
  };

  if (!user) return null;

  if (loading) {
    return <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!other) {
    return (
      <div className="flex-1 grid place-items-center p-6 text-center">
        <div>
          <p className="text-muted-foreground">User not found.</p>
          <Link to="/messages" className="text-primary hover:underline mt-2 inline-block">Back to messages</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/messages" })} className="md:hidden p-1 -ml-1 rounded hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Link to="/u/$username" params={{ username: other.username }} className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80">
          <UserAvatar name={other.display_name ?? other.username} url={other.avatar_url} size="md" />
          <div className="min-w-0">
            <div className="font-semibold truncate">{other.display_name ?? other.username}</div>
            <div className="text-xs text-muted-foreground font-mono truncate">@{other.username}</div>
          </div>
        </Link>
        <Button variant="ghost" size="sm" onClick={toggleBlock} className="gap-2">
          {blocked ? <><ShieldOff className="h-4 w-4" /> Unblock</> : <><Ban className="h-4 w-4" /> Block</>}
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-12">
            No messages yet. Start the conversation.
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          const atts = Array.isArray(m.attachments) ? m.attachments : [];
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap space-y-2",
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-surface border border-border rounded-bl-sm",
                )}
              >
                {atts.length > 0 && (
                  <div className="space-y-2">
                    {atts.map((a, i) => (
                      <DmAttachment key={i} att={a} mine={mine} />
                    ))}
                  </div>
                )}
                {m.body && <div>{m.body}</div>}
                <div className={cn("text-[10px] opacity-70", mine ? "text-right" : "text-left")}>
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  {mine && m.read_at && " · read"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border bg-surface/50 p-3">
        {blocked ? (
          <div className="text-sm text-muted-foreground text-center">
            You blocked this user. Unblock to send messages.
          </div>
        ) : blockedByOther ? (
          <div className="text-sm text-muted-foreground text-center">You can't message this user.</div>
        ) : (
          <div className="space-y-2">
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-md bg-accent text-xs max-w-[220px]"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removePending(i)}
                      className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive shrink-0"
                      aria-label="Remove file"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => addFiles(e.target.files)}
                accept="image/*,application/pdf,video/*,audio/*,.doc,.docx,.txt,.zip,.csv,.xlsx,.pptx"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || pendingFiles.length >= MAX_FILES}
                aria-label="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={`Message @${other.username}…`}
                rows={1}
                maxLength={4000}
                className="resize-none min-h-[44px] max-h-32"
              />
              <Button
                onClick={send}
                disabled={(!body.trim() && pendingFiles.length === 0) || sending}
                size="icon"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
