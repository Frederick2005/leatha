import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Swords, Plus, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/arena/battles")({ component: BattlesPage });

interface Battle { id: string; mode: string; state: string; host_id: string; duration_seconds: number; created_at: string; arena_battle_participants: { user_id: string }[] }

function BattlesPage() {
  const { user } = useAuth();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [mode, setMode] = useState("1v1");

  async function load() {
    const { data } = await supabase
      .from("arena_battles")
      .select("id,mode,state,host_id,duration_seconds,created_at,arena_battle_participants(user_id)")
      .in("state", ["pending", "live"])
      .order("created_at", { ascending: false })
      .limit(20);
    setBattles((data ?? []) as unknown as Battle[]);
  }

  useEffect(() => { void load(); }, []);

  async function createBattle() {
    if (!user) return;
    const { data, error } = await supabase.from("arena_battles").insert([{ host_id: user.id, mode: mode as "1v1", duration_seconds: 600 }]).select().maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Failed");
    await supabase.from("arena_battle_participants").insert({ battle_id: data.id, user_id: user.id });
    toast.success("Battle created — waiting for opponent");
    void load();
  }

  async function joinBattle(b: Battle) {
    if (!user) return;
    if (b.arena_battle_participants.some((p) => p.user_id === user.id)) return toast("You're already in this battle");
    const { error } = await supabase.from("arena_battle_participants").insert({ battle_id: b.id, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Joined battle");
    void load();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Swords className="h-6 w-6 text-primary" /> Battles</h1>
          <p className="text-sm text-muted-foreground">Live competitions. Fastest correct solve wins.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-sm">
            {["1v1","team","classroom","survival","speedrun","boss"].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <Button onClick={createBattle}><Plus className="h-4 w-4 mr-1" /> New battle</Button>
        </div>
      </header>

      {battles.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No active battles. Create one and challenge the arena.
        </div>
      ) : (
        <div className="grid gap-3">
          {battles.map((b) => (
            <div key={b.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={b.state === "live" ? "default" : "secondary"}>{b.state}</Badge>
                  <span className="font-mono text-xs uppercase">{b.mode}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {b.arena_battle_participants.length}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {Math.round(b.duration_seconds / 60)}m</span>
                </div>
              </div>
              <Button size="sm" onClick={() => joinBattle(b)} disabled={b.host_id === user?.id}>
                {b.host_id === user?.id ? "Your battle" : "Join"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Swords, Plus, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/arena/battles")({ component: BattlesPage });

interface Battle { id: string; mode: string; state: string; host_id: string; duration_seconds: number; created_at: string; arena_battle_participants: { user_id: string }[] }

function BattlesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [mode, setMode] = useState("1v1");

  async function load() {
    const { data } = await supabase
      .from("arena_battles")
      .select("id,mode,state,host_id,duration_seconds,created_at,arena_battle_participants(user_id)")
      .in("state", ["pending", "live"])
      .order("created_at", { ascending: false })
      .limit(20);
    setBattles((data ?? []) as unknown as Battle[]);
  }

  useEffect(() => { void load(); }, []);

  async function createBattle() {
    if (!user) return;
    const { data, error } = await supabase.from("arena_battles").insert([{ host_id: user.id, mode: mode as "1v1", duration_seconds: 600 }]).select().maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Failed");
    await supabase.from("arena_battle_participants").insert({ battle_id: data.id, user_id: user.id });
    toast.success("Battle created — share the room link");
    navigate({ to: "/arena/battles/$id", params: { id: data.id } });
  }

  async function joinBattle(b: Battle) {
    if (!user) return;
    if (!b.arena_battle_participants.some((p) => p.user_id === user.id)) {
      const { error } = await supabase.from("arena_battle_participants").insert({ battle_id: b.id, user_id: user.id });
      if (error) return toast.error(error.message);
    }
    navigate({ to: "/arena/battles/$id", params: { id: b.id } });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Swords className="h-6 w-6 text-primary" /> Battles</h1>
          <p className="text-sm text-muted-foreground">Live competitions. Fastest correct solve wins.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-sm">
            {["1v1","team","classroom","survival","speedrun","boss"].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <Button onClick={createBattle}><Plus className="h-4 w-4 mr-1" /> New battle</Button>
        </div>
      </header>

      {battles.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No active battles. Create one and challenge the arena.
        </div>
      ) : (
        <div className="grid gap-3">
          {battles.map((b) => (
            <div key={b.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={b.state === "live" ? "default" : "secondary"}>{b.state}</Badge>
                  <span className="font-mono text-xs uppercase">{b.mode}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {b.arena_battle_participants.length}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {Math.round(b.duration_seconds / 60)}m</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/arena/battles/$id" params={{ id: b.id }}>Open room</Link>
                </Button>
                <Button size="sm" onClick={() => joinBattle(b)}>
                  {b.host_id === user?.id ? "Enter" : "Join"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
