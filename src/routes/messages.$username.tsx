import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import {
  Send, ArrowLeft, Ban, ShieldOff, Paperclip, X, Loader2, Mic, Check, CheckCheck, Play, Pause, Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type AttachmentMeta } from "@/components/dm-attachment";
import { RequireAuth } from "@/components/require-auth";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 6;

export const Route = createFileRoute("/messages/$username")({
  component: () => (<RequireAuth><ThreadPage /></RequireAuth>),
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

const EMOJIS = ["😀", "😂", "❤️", "🔥", "👍", "🎉", "🙌", "🤔", "😎", "👀", "💡", "📚", "✅", "🚀", "🥳", "😅"];

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initial load
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

      if (!prof || cancelled) { setLoading(false); return; }
      setOther(prof as OtherProfile);

      const [{ data: msgs }, { data: blocks }] = await Promise.all([
        supabase
          .from("direct_messages")
          .select("*")
          .or(`and(sender_id.eq.${user.id},recipient_id.eq.${prof.id}),and(sender_id.eq.${prof.id},recipient_id.eq.${user.id})`)
          .order("created_at", { ascending: true })
          .limit(500),
        supabase
          .from("blocks")
          .select("blocker_id, blocked_id")
          .eq("blocker_id", user.id)
          .eq("blocked_id", prof.id),
      ]);
      if (cancelled) return;
      setMessages((msgs ?? []) as unknown as DM[]);
      setBlocked((blocks ?? []).length > 0);

      const unreadIds = (msgs ?? [])
        .filter((m) => m.recipient_id === user.id && !m.read_at)
        .map((m) => m.id);
      if (unreadIds.length) {
        await supabase.from("direct_messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, username]);

  // Realtime
  useEffect(() => {
    if (!user || !other) return;
    const channel = supabase
      .channel(`dm-${user.id}-${other.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const row = payload.new as DM;
        const involves =
          (row.sender_id === user.id && row.recipient_id === other.id) ||
          (row.sender_id === other.id && row.recipient_id === user.id);
        if (!involves) return;
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        if (row.recipient_id === user.id) {
          void supabase.from("direct_messages").update({ read_at: new Date().toISOString() }).eq("id", row.id);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages" }, (payload) => {
        const row = payload.new as DM;
        setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, read_at: row.read_at } : m)));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, other]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const next = [...pendingFiles];
    for (const f of incoming) {
      if (next.length >= MAX_FILES) { toast.error(`Max ${MAX_FILES} files per message`); break; }
      if (f.size > MAX_FILE_BYTES) { toast.error(`${f.name} exceeds 25 MB`); continue; }
      next.push(f);
    }
    setPendingFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadOne = async (file: File): Promise<AttachmentMeta> => {
    if (!user || !other) throw new Error("not ready");
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${user.id}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage
      .from("chat-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return { path, name: file.name, size: file.size, type: file.type || "application/octet-stream" };
  };

  const send = async (extraAttachments: AttachmentMeta[] = []) => {
    if (!user || !other || sending) return;
    const text = body.trim().slice(0, 4000);
    if (!text && pendingFiles.length === 0 && extraAttachments.length === 0) return;
    setSending(true);

    let uploaded: AttachmentMeta[] = [...extraAttachments];
    try {
      if (pendingFiles.length) uploaded = uploaded.concat(await Promise.all(pendingFiles.map(uploadOne)));
    } catch (e) {
      setSending(false);
      toast.error(e instanceof Error ? e.message : "Upload failed");
      return;
    }

    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id,
      recipient_id: other.id,
      body: text,
      attachments: uploaded as unknown as never,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setBody("");
    setPendingFiles([]);
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recordChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordChunksRef.current, { type: mime || "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        try {
          const att = await uploadOne(file);
          await send([att]);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Voice note failed");
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = (cancel = false) => {
    const rec = recorderRef.current;
    if (recordTimerRef.current) { window.clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setRecording(false);
    if (!rec) return;
    if (cancel) {
      rec.ondataavailable = null;
      rec.onstop = () => rec.stream.getTracks().forEach((t) => t.stop());
    }
    if (rec.state !== "inactive") rec.stop();
  };

  const toggleBlock = async () => {
    if (!user || !other) return;
    if (blocked) {
      const { error } = await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", other.id);
      if (error) return toast.error(error.message);
      setBlocked(false); toast.success("User unblocked");
    } else {
      const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: other.id });
      if (error) return toast.error(error.message);
      setBlocked(true); toast.success("User blocked");
    }
  };

  if (!user) return null;
  if (loading) return <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Loading…</div>;
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

  // Group messages by day
  const groups: { label: string; items: DM[] }[] = [];
  for (const m of messages) {
    const d = new Date(m.created_at);
    const label = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "MMM d, yyyy");
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(m);
    else groups.push({ label, items: [m] });
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-[hsl(var(--chat-bg,210_15%_15%))]">
      {/* WhatsApp-style header */}
      <header className="border-b border-border px-3 py-2.5 flex items-center gap-3 bg-card">
        <button onClick={() => navigate({ to: "/messages" })} className="md:hidden p-1 -ml-1 rounded hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Link to="/u/$username" params={{ username: other.username }} className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80">
          <UserAvatar name={other.display_name ?? other.username} url={other.avatar_url} size="md" />
          <div className="min-w-0">
            <div className="font-semibold truncate leading-tight">{other.display_name ?? other.username}</div>
            <div className="text-[11px] text-muted-foreground font-mono truncate">@{other.username}</div>
          </div>
        </Link>
        <Button variant="ghost" size="sm" onClick={toggleBlock} className="gap-2">
          {blocked ? <><ShieldOff className="h-4 w-4" /> Unblock</> : <><Ban className="h-4 w-4" /></>}
        </Button>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 25%, hsl(var(--primary) / 0.06) 0%, transparent 50%), radial-gradient(circle at 75% 75%, hsl(var(--primary) / 0.04) 0%, transparent 50%)",
        }}
      >
        {messages.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-12">
            No messages yet. Say hi 👋
          </div>
        )}

        {groups.map((g) => (
          <div key={g.label} className="space-y-1">
            <div className="flex justify-center my-3">
              <span className="text-[11px] px-3 py-1 rounded-full bg-card/80 backdrop-blur text-muted-foreground border border-border/50">
                {g.label}
              </span>
            </div>
            {g.items.map((m, i) => {
              const mine = m.sender_id === user.id;
              const prev = g.items[i - 1];
              const grouped = prev && prev.sender_id === m.sender_id && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) < 60_000;
              return <Bubble key={m.id} m={m} mine={mine} grouped={!!grouped} />;
            })}
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card px-2 py-2">
        {blocked ? (
          <div className="text-sm text-muted-foreground text-center py-2">
            You blocked this user. Unblock to send messages.
          </div>
        ) : recording ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <button onClick={() => stopRecording(true)} className="p-2 rounded-full hover:bg-destructive/10 text-destructive" aria-label="Cancel">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 flex-1">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm text-muted-foreground font-mono">
                {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:{String(recordSeconds % 60).padStart(2, "0")}
              </span>
              <span className="text-xs text-muted-foreground ml-2">Recording voice note…</span>
            </div>
            <Button onClick={() => stopRecording(false)} size="icon" className="rounded-full">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {pendingFiles.map((f, i) => {
                  const isImg = f.type.startsWith("image/");
                  return (
                    <div key={i} className="relative group">
                      {isImg ? (
                        <img src={URL.createObjectURL(f)} alt={f.name} className="h-16 w-16 object-cover rounded-lg border border-border" />
                      ) : (
                        <div className="h-16 px-3 flex items-center gap-2 rounded-lg border border-border bg-accent text-xs max-w-[180px]">
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-destructive text-destructive-foreground"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {showEmoji && (
              <div className="grid grid-cols-8 gap-1 p-2 rounded-lg bg-accent/40 border border-border">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setBody((b) => b + e); inputRef.current?.focus(); }}
                    className="text-xl hover:bg-accent rounded p-1"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => addFiles(e.target.files)}
                accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt,.zip,.csv,.xlsx,.pptx"
              />
              <button type="button" onClick={() => setShowEmoji((s) => !s)} className="p-2 rounded-full hover:bg-accent text-muted-foreground" aria-label="Emoji">
                <Smile className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={pendingFiles.length >= MAX_FILES} className="p-2 rounded-full hover:bg-accent text-muted-foreground" aria-label="Attach">
                <Paperclip className="h-5 w-5" />
              </button>
              <div className="flex-1 bg-background rounded-3xl border border-border px-3 py-2 max-h-32 overflow-auto">
                <textarea
                  ref={inputRef}
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
                  className="w-full bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground"
                />
              </div>
              {body.trim() || pendingFiles.length ? (
                <Button onClick={() => send()} disabled={sending} size="icon" className="rounded-full h-10 w-10">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="h-10 w-10 grid place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  aria-label="Record voice note"
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ m, mine, grouped }: { m: DM; mine: boolean; grouped: boolean }) {
  const atts = Array.isArray(m.attachments) ? m.attachments : [];
  const time = format(new Date(m.created_at), "HH:mm");
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-2")}>
      <div
        className={cn(
          "max-w-[78%] sm:max-w-[65%] px-2.5 py-1.5 rounded-2xl text-sm break-words whitespace-pre-wrap shadow-sm relative",
          mine
            ? "bg-[hsl(120_45%_30%)] text-white rounded-br-md"
            : "bg-card text-foreground rounded-bl-md border border-border/50",
        )}
      >
        {atts.length > 0 && (
          <div className="space-y-1.5 mb-1">
            {atts.map((a, i) => <ChatAttachment key={i} att={a} mine={mine} />)}
          </div>
        )}
        {m.body && <div className="px-1">{m.body}</div>}
        <div className={cn("flex items-center justify-end gap-1 -mb-0.5 mt-0.5 text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>
          <span>{time}</span>
          {mine && (m.read_at ? <CheckCheck className="h-3.5 w-3.5 text-sky-300" /> : <Check className="h-3.5 w-3.5" />)}
        </div>
      </div>
    </div>
  );
}

function ChatAttachment({ att, mine }: { att: AttachmentMeta; mine: boolean }) {
  const url = supabase.storage.from("chat-media").getPublicUrl(att.path).data.publicUrl;
  const isImage = att.type.startsWith("image/");
  const isVideo = att.type.startsWith("video/");
  const isAudio = att.type.startsWith("audio/");

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img src={url} alt={att.name} className="max-w-[280px] max-h-[280px] rounded-lg object-cover" loading="lazy" />
      </a>
    );
  }
  if (isVideo) {
    return <video src={url} controls className="max-w-[280px] max-h-[280px] rounded-lg" />;
  }
  if (isAudio) {
    return <VoicePlayer url={url} mine={mine} />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg max-w-xs",
        mine ? "bg-white/10 hover:bg-white/20" : "bg-accent hover:bg-accent/70",
      )}
    >
      <Paperclip className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{att.name}</div>
        <div className="text-[10px] opacity-70">{(att.size / 1024).toFixed(1)} KB</div>
      </div>
    </a>
  );
}

function VoicePlayer({ url, mine }: { url: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => setDuration(a.duration || 0);
    const onTime = () => setProgress(a.currentTime || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { void a.play(); setPlaying(true); }
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg min-w-[200px]", mine ? "bg-white/10" : "bg-accent")}>
      <button onClick={toggle} className={cn("h-8 w-8 grid place-items-center rounded-full", mine ? "bg-white/20" : "bg-primary text-primary-foreground")}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex-1">
        <div className={cn("h-1 rounded-full overflow-hidden", mine ? "bg-white/20" : "bg-background")}>
          <div className={cn("h-full transition-all", mine ? "bg-white" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[10px] mt-1 opacity-70">{fmt(playing || progress > 0 ? progress : duration)}</div>
      </div>
      <Mic className="h-4 w-4 opacity-60" />
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
    </div>
  );
}
