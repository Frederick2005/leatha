import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { FileText, Upload, Download, Trash2, Globe, Lock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Documents — Leatha" }] }),
  component: () => (<RequireAuth><DocumentsPage /></RequireAuth>),
});

interface Doc { id: string; title: string; file_url: string; file_path: string; file_type: string | null; file_size_bytes: number; subject: string | null; visibility: string; created_at: string; owner_id: string; }

const VIS_ICON: Record<string, any> = { private: Lock, students: Users, public: Globe };

function DocumentsPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any).from("documents").select("*").order("created_at", { ascending: false });
    setDocs((data ?? []) as Doc[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const del = async (d: Doc) => {
    if (!confirm("Delete this document?")) return;
    await supabase.storage.from("documents").remove([d.file_path]);
    const { error } = await (supabase as any).from("documents").delete().eq("id", d.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); void load(); }
  };

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.file_path, 60);
    if (error || !data) { toast.error("Could not create download link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold">Documents</h1>
          <p className="text-sm text-muted-foreground">Notes, PDFs, and study materials.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Upload className="h-4 w-4 mr-1.5" /> Upload</Button></DialogTrigger>
          <UploadDialog onDone={() => { setOpen(false); void load(); }} />
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-16 rounded-xl border bg-card animate-pulse" />)}</div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">No documents yet. Click Upload to add one.</div>
      ) : (
        <ul className="space-y-2">
          {docs.map(d => {
            const VIcon = VIS_ICON[d.visibility] ?? Lock;
            const isOwn = d.owner_id === user.id;
            const ext = (d.file_type ?? "").toUpperCase();
            return (
              <li key={d.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-md bg-rose-500/10 text-rose-600 grid place-items-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground font-mono flex items-center gap-3">
                    <span>{ext || "FILE"}</span>
                    <span>{(d.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                    <span>Uploaded {format(new Date(d.created_at), "d MMM yyyy")}</span>
                    <span className="flex items-center gap-1"><VIcon className="h-3 w-3" />{d.visibility}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => download(d)}><Download className="h-3.5 w-3.5" /></Button>
                {isOwn && <Button size="sm" variant="outline" onClick={() => del(d)}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function UploadDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    const file = inputRef.current?.files?.[0];
    if (!file || !user) { toast.error("Pick a file"); return; }
    if (!title) { toast.error("Title required"); return; }
    setBusy(true);
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }
    const { data: pub } = supabase.storage.from("documents").getPublicUrl(path);
    const { error } = await (supabase as any).from("documents").insert({
      owner_id: user.id, title, subject: subject || null, visibility, file_path: path,
      file_url: pub.publicUrl, file_type: ext, file_size_bytes: file.size,
    });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Uploaded"); onDone(); }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>File</Label><Input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx" /></div>
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mathematics Notes" /></div>
        <div><Label>Subject (optional)</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div><Label>Visibility</Label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private (only me)</SelectItem>
              <SelectItem value="students">My students</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter><Button onClick={upload} disabled={busy}>{busy ? "Uploading…" : "Upload"}</Button></DialogFooter>
    </DialogContent>
  );
}
