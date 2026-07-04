import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * A <Select> that always contains an "Other…" entry.
 * When the user picks it, a small inline input appears to type a new value.
 * On save that value is:
 *   1) applied via onChange
 *   2) persisted to `custom_options` so it shows up for everyone next time.
 */
export function DynamicSelect({
  category, value, onChange, options: seed = [], placeholder = "Select…", disabled,
}: {
  category: string;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const [options, setOptions] = useState<string[]>(seed);
  const [pickingOther, setPickingOther] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await (supabase as any)
        .from("custom_options")
        .select("value")
        .eq("category", category)
        .order("usage_count", { ascending: false })
        .limit(200);
      if (!alive) return;
      const merged = Array.from(new Set([...seed, ...((data ?? []).map((r: any) => r.value as string))]));
      setOptions(merged);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const commitOther = async () => {
    const v = draft.trim();
    if (!v) return;
    setBusy(true);
    if (user) {
      // Try insert; if it already exists, bump usage count.
      const { error } = await (supabase as any).from("custom_options").insert({
        category, value: v, created_by: user.id,
      });
      if (error && !/duplicate|unique/i.test(error.message)) {
        toast.error(error.message);
      }
    }
    setOptions((prev) => (prev.includes(v) ? prev : [...prev, v]));
    onChange(v);
    setPickingOther(false);
    setDraft("");
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      <Select
        value={pickingOther ? "__other__" : value}
        onValueChange={(v) => {
          if (v === "__other__") { setPickingOther(true); return; }
          setPickingOther(false);
          onChange(v);
        }}
        disabled={disabled}
      >
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
          <SelectItem value="__other__">Other…</SelectItem>
        </SelectContent>
      </Select>
      {pickingOther && (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type new value"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void commitOther(); } }}
            autoFocus
          />
          <Button type="button" onClick={commitOther} disabled={busy || !draft.trim()}>Add</Button>
          <Button type="button" variant="ghost" onClick={() => { setPickingOther(false); setDraft(""); }}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
