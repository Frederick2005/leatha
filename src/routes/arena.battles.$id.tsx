import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clock, Crown, Play, Swords, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/arena/battles/$id")({ component: BattleRoom });

interface Battle {
  id: string; mode: string; state: "pending" | "live" | "finished" | string;
  host_id: string; duration_seconds: number; starts_at: string | null; ends_at: string | null;
  challenge_id: string | null; winner_id: string | null;
}
interface Participant { user_id: string; score: number; team: string | null; joined_at: string; profile?: { username: string; display_name: string | null; avatar_url: string | null } }

function BattleRoom() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [now, setNow] = useState(Date.now());
  const [liveScores, setLiveScores] = useState<Record<string, number>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load battle + participants
  async function load() {
    const [{ data: b }, { data: p }] = await Promise.all([
      supabase.from("arena_battles").select("*").eq("id", id).maybeSingle(),
      supabase.from("arena_battle_participants")
        .select("user_id,score,team,joined_at,profile:profiles!arena_battle_participants_user_id_fkey(username,display_name,avatar_url)")
        .eq("battle_id", id),
    ]);
    if (b) setBattle(b as unknown as Battle);
    if (p) setParticipants(p as unknown as Participant[]);
  }
  useEffect(() => { void load(); }, [id]);

  // Tick clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Realtime channel for presence + score broadcasts
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`battle:${id}`, { config: { presence: { key: user.id } } });
    ch.on("broadcast", { event: "score" }, ({ payload }) => {
      setLiveScores((s) => ({ ...s, [payload.user_id]: payload.score }));
    });
    ch.on("broadcast", { event: "start" }, () => { void load(); });
    ch.on("broadcast", { event: "end" }, () => { void load(); toast("Battle ended"); });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ online_at: Date.now() });
    });
    channelRef.current = ch;
    return () => { void supabase.removeChannel(ch); channelRef.current = null; };
  }, [id, user]);

  const isHost = battle?.host_id === user?.id;
  const isParticipant = participants.some((p) => p.user_id === user?.id);
  const endsAtMs = battle?.ends_at ? new Date(battle.ends_at).getTime() : null;
  const secondsLeft = endsAtMs ? Math.max(0, Math.floor((endsAtMs - now) / 1000)) : battle?.duration_seconds ?? 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const ranked = useMemo(() => {
    const merged = participants.map((p) => ({ ...p, liveScore: liveScores[p.user_id] ?? p.score }));
    return merged.sort((a, b) => b.liveScore - a.liveScore);
  }, [participants, liveScores]);

  async function startBattle() {
    if (!battle || !isHost) return;
    const starts = new Date();
    const ends = new Date(starts.getTime() + battle.duration_seconds * 1000);
    const { error } = await supabase.from("arena_battles").update({
      state: "live", starts_at: starts.toISOString(), ends_at: ends.toISOString(),
    }).eq("id", battle.id);
    if (error) return toast.error(error.message);
    channelRef.current?.send({ type: "broadcast", event: "start", payload: {} });
    toast.success("Battle started!");
    void load();
  }

  async function endBattle() {
    if (!battle || !isHost) return;
    const winner = ranked[0];
    const { error } = await supabase.from("arena_battles").update({
      state: "finished", winner_id: winner?.user_id ?? null,
    }).eq("id", battle.id);
    if (error) return toast.error(error.message);
    channelRef.current?.send({ type: "broadcast", event: "end", payload: {} });
    void load();
  }

  async function bumpScore() {
    if (!user || !isParticipant || battle?.state !== "live") return;
    const next = (liveScores[user.id] ?? participants.find((p) => p.user_id === user.id)?.score ?? 0) + 10;
    setLiveScores((s) => ({ ...s, [user.id]: next }));
    channelRef.current?.send({ type: "broadcast", event: "score", payload: { user_id: user.id, score: next } });
    // Persist async
    await supabase.from("arena_battle_participants").update({ score: next }).eq("battle_id", id).eq("user_id", user.id);
  }

  // Auto-end when timer hits 0
  useEffect(() => {
    if (battle?.state === "live" && endsAtMs && now >= endsAtMs && isHost) void endBattle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, battle?.state, endsAtMs, isHost]);

  if (!battle) return <div className="max-w-4xl mx-auto px-4 py-10 text-center text-muted-foreground">Loading battle…</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button onClick={() => navigate({ to: "/arena/battles" })} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-3 w-3" /> All battles
      </button>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase font-mono text-muted-foreground">
              <Swords className="h-3.5 w-3.5" /> {battle.mode}
              <Badge variant={battle.state === "live" ? "default" : battle.state === "finished" ? "secondary" : "outline"}>{battle.state}</Badge>
            </div>
            <h1 className="font-display text-2xl font-bold mt-1">Battle room</h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground font-mono uppercase flex items-center gap-1 justify-end"><Clock className="h-3 w-3" /> {battle.state === "pending" ? "Awaiting start" : "Time left"}</div>
            <div className="text-3xl font-display font-bold tabular-nums">{mm}:{ss}</div>
          </div>
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          {isHost && battle.state === "pending" && (
            <Button onClick={startBattle} disabled={participants.length < 2}>
              <Play className="h-4 w-4 mr-1" /> Start ({participants.length} joined)
            </Button>
          )}
          {isHost && battle.state === "live" && (
            <Button variant="outline" onClick={endBattle}>End battle</Button>
          )}
          {isParticipant && battle.state === "live" && (
            <Button onClick={bumpScore} variant="secondary">+10 score (demo)</Button>
          )}
          {battle.challenge_id && (
            <Button asChild variant="outline">
              <Link to="/arena/challenges/$slug" params={{ slug: battle.challenge_id }}>Open challenge</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 mt-4">
        <h2 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <Users className="h-4 w-4" /> Participants ({participants.length})
        </h2>
        {ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has joined yet.</p>
        ) : (
          <ul className="space-y-2">
            {ranked.map((p, i) => (
              <li key={p.user_id} className={`flex items-center gap-3 px-3 py-2 rounded-md border ${i === 0 && battle.state !== "pending" ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                <span className="font-mono text-xs w-6 text-muted-foreground">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {p.profile?.display_name ?? p.profile?.username ?? "Player"}
                    {p.user_id === battle.host_id && <Crown className="inline h-3 w-3 ml-1 text-warning" />}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">@{p.profile?.username ?? "—"}</div>
                </div>
                <div className="text-lg font-display font-bold tabular-nums">{p.liveScore}</div>
              </li>
            ))}
          </ul>
        )}
        {battle.state === "finished" && battle.winner_id && (
          <div className="mt-4 p-3 rounded-md border border-warning/40 bg-warning/10 flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-warning" />
            Winner: <span className="font-semibold">{ranked.find((p) => p.user_id === battle.winner_id)?.profile?.username ?? "—"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
