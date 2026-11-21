import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { FileText, Upload, Download, Trash2, Globe, Lock, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Documents — Leatha" }] }),
  component: () => (
    <RequireAuth>
      <DocumentsPage />
    </RequireAuth>
  ),
});

interface Doc {
  id: string;
  title: string;
  file_url: string;
  file_path: string;
  file_type: string | null;
  file_size_bytes: number;
  subject: string | null;
  visibility: string;
  created_at: string;
  owner_id: string;
}

const VIS_ICON: Record<string, LucideIcon> = { private: Lock, students: Users, public: Globe };

function DocumentsPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(`Could not load documents: ${error.message}`);
      setDocs([]);
    } else {
      setDocs((data ?? []) as Doc[]);
    }
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  const del = async (d: Doc) => {
    if (!user) return;
    if (!confirm("Delete this document?")) return;
    // Remove the visible database record first. If storage cleanup fails, the
    // user no longer sees a broken document; the orphaned object can be cleaned
    // up by an administrator without losing the metadata transaction.
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", d.id)
      .eq("owner_id", user.id);
    if (error) {
      toast.error(`Could not delete document: ${error.message}`);
      return;
    }
    const { error: storageError } = await supabase.storage.from("documents").remove([d.file_path]);
    if (storageError) {
      toast.error(
        "Document removed from your library, but file cleanup failed. Please contact support.",
      );
    } else {
      toast.success("Deleted");
    }
    void load();
  };

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(d.file_path, 60);
    if (error || !data) {
      toast.error("Could not create download link");
      return;
    }
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
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-1.5" /> Upload
            </Button>
          </DialogTrigger>
          <UploadDialog
            onDone={() => {
              setOpen(false);
              void load();
            }}
          />
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl border bg-card animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          No documents yet. Click Upload to add one.
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => {
            const VIcon = VIS_ICON[d.visibility] ?? Lock;
            const isOwn = d.owner_id === user.id;
            const ext = (d.file_type ?? "").toUpperCase();
            return (
              <li
                key={d.id}
                className="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
              >
                <div className="h-10 w-10 rounded-md bg-rose-500/10 text-rose-600 grid place-items-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground font-mono flex items-center gap-3">
                    <span>{ext || "FILE"}</span>
                    <span>{(d.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                    <span>Uploaded {format(new Date(d.created_at), "d MMM yyyy")}</span>
                    <span className="flex items-center gap-1">
                      <VIcon className="h-3 w-3" />
                      {d.visibility}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => download(d)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {isOwn && (
                  <Button size="sm" variant="outline" onClick={() => del(d)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
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
    if (!file || !user) {
      toast.error("Pick a file");
      return;
    }
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const allowedExtensions = new Set(["pdf", "doc", "docx", "txt", "ppt", "pptx", "xls", "xlsx"]);
    if (!allowedExtensions.has(ext)) {
      toast.error("Unsupported file type. Choose a PDF, Word, text, PowerPoint or Excel file.");
      return;
    }
    const maxBytes = 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("Files must be 20 MB or smaller.");
      return;
    }
    setBusy(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const mimeByExtension: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
      contentType: mimeByExtension[ext],
      upsert: false,
    });
    if (upErr) {
      setBusy(false);
      toast.error(upErr.message);
      return;
    }
    const { error } = await supabase.from("documents").insert({
      owner_id: user.id,
      title: title.trim(),
      subject: subject.trim() || null,
      visibility,
      file_path: path,
      // Legacy column: store the private storage key, never a public URL.
      file_url: path,
      file_type: ext,
      file_size_bytes: file.size,
    });
    if (error) {
      await supabase.storage.from("documents").remove([path]);
      setBusy(false);
      toast.error(`File uploaded but its record could not be saved: ${error.message}`);
      return;
    }
    setBusy(false);
    toast.success("Uploaded");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Upload document</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>File</Label>
          <Input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx" />
        </div>
        <div>
          <Label>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mathematics Notes"
          />
        </div>
        <div>
          <Label>Subject (optional)</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label>Visibility</Label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private (only me)</SelectItem>
              <SelectItem value="students">My students</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={upload} disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
