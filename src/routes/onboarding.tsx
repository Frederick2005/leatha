import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, X, GraduationCap, BookOpen, Sparkles, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { LeathaLogo } from "@/components/leatha-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to Leatha" }] }),
  component: () => (<RequireAuth><Onboarding /></RequireAuth>),
});

const GRADES = ["S1", "S2", "S3", "S4", "S5", "S6", "University", "Other"];
const EXPERIENCE = ["Just starting", "1-5 years", "6-10 years", "10+ years"];
const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "English",
  "Literature", "History", "Geography", "Computer Studies",
  "Commerce", "Economics", "Agriculture", "Art", "Music",
];

type AccountType = "student" | "teacher";

function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [experience, setExperience] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Pre-fill from profile
  useEffect(() => {
    if (!profile) return;
    if (!displayName) setDisplayName(profile.display_name ?? profile.username ?? "");
    if (!username && profile.username) {
      const seed = (profile.display_name ?? profile.username ?? "")
        .toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_]/g, "").slice(0, 20);
      setUsername(seed || profile.username);
    }
    if (profile.account_type === "teacher") setAccountType("teacher");
    if (profile.account_type === "student") setAccountType("student");
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect already-completed users
  useEffect(() => {
    const p = profile as unknown as { has_completed_onboarding?: boolean; account_type?: string; school?: string | null } | null;
    if (p?.has_completed_onboarding && p.account_type && p.school) {
      navigate({ to: "/dashboard-route", replace: true });
    }
  }, [profile, navigate]);

  // Username availability check
  useEffect(() => {
    if (!username) { setUsernameStatus("idle"); return; }
    const valid = /^[a-z0-9_]{3,20}$/.test(username);
    if (!valid) { setUsernameStatus("invalid"); return; }
    if (profile?.username === username) { setUsernameStatus("available"); return; }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      setUsernameStatus(data ? "taken" : "available");
    }, 500);
    return () => clearTimeout(t);
  }, [username, profile?.username]);

  const totalSteps = 4;
  const progress = useMemo(() => Math.round(((step + 1) / totalSteps) * 100), [step]);

  const toggleSubject = (s: string) =>
    setSubjects((arr) => arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]);

  const canContinueStep0 = accountType !== null;
  const canContinueStep1 = usernameStatus === "available" && displayName.trim().length >= 2;
  const canFinishStep2 = accountType === "student"
    ? school.trim().length >= 2 && grade && subjects.length >= 1
    : school.trim().length >= 2 && experience && subjects.length >= 1;

  const finish = async () => {
    if (!user || !accountType) return;
    setBusy(true);
    const updates = {
      username,
      display_name: displayName.trim(),
      account_type: accountType,
      school: school.trim(),
      grade: accountType === "student" ? grade : null,
      experience: accountType === "teacher" ? experience : null,
      subjects,
      interests: subjects,
      has_completed_onboarding: true,
    };
    const { error } = await supabase.from("profiles").update(updates as never).eq("id", user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    setStep(3);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Progress */}
      <div className="px-6 pt-6">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <LeathaLogo size={28} />
          <span className="font-display font-semibold">Leatha</span>
          <div className="flex-1" />
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i <= step ? "w-6 bg-primary" : "w-2 bg-muted",
                )}
              />
            ))}
          </div>
        </div>
        <div className="h-1 w-full max-w-2xl mx-auto rounded-full bg-muted overflow-hidden mt-3">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 grid place-items-center px-4 py-8 overflow-hidden">
        <div className="w-full max-w-2xl relative">
          <div
            className="transition-transform duration-300 ease-out"
            style={{ transform: `translateX(0)` }}
          >
            {step === 0 && (
              <StepWrap>
                <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
                  Welcome to Leatha{displayName ? `, ${displayName.split(" ")[0]}` : ""}!
                </h1>
                <p className="text-muted-foreground mt-2">How are you joining us today?</p>

                <div className="mt-8 grid sm:grid-cols-2 gap-4">
                  <RoleCard
                    selected={accountType === "teacher"}
                    onClick={() => setAccountType("teacher")}
                    icon={<GraduationCap className="h-8 w-8" />}
                    color="emerald"
                    title="I'm a Teacher"
                    description="Share lessons, guide students, build your reputation"
                  />
                  <RoleCard
                    selected={accountType === "student"}
                    onClick={() => setAccountType("student")}
                    icon={<BookOpen className="h-8 w-8" />}
                    color="sky"
                    title="I'm a Student"
                    description="Learn, take on challenges, grow your skills"
                  />
                </div>

                <Footer onNext={() => setStep(1)} nextDisabled={!canContinueStep0} />
              </StepWrap>
            )}

            {step === 1 && (
              <StepWrap>
                <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Choose your @username</h1>
                <p className="text-muted-foreground mt-2">This is how others find you. It cannot be changed later.</p>

                <div className="mt-8 space-y-5">
                  <div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">@</span>
                      <Input
                        autoFocus
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                        className="pl-7 pr-10 font-mono text-base"
                        placeholder="yourname"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {usernameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        {usernameStatus === "available" && <Check className="h-4 w-4 text-emerald-500" />}
                        {usernameStatus === "taken" && <X className="h-4 w-4 text-destructive" />}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {usernameStatus === "taken" ? <span className="text-destructive">Taken. Try another.</span>
                        : usernameStatus === "invalid" ? <span className="text-destructive">Use 3–20 lowercase letters, numbers, or _</span>
                        : usernameStatus === "available" ? <span className="text-emerald-500">Available · leatha.app/u/{username}</span>
                        : `Your profile: leatha.app/u/${username || "username"}`}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Display name</label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
                      className="mt-1.5"
                      placeholder="Your full name"
                    />
                    <p className="text-xs text-muted-foreground mt-1">This can be changed anytime</p>
                  </div>
                </div>

                <Footer onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!canContinueStep1} />
              </StepWrap>
            )}

            {step === 2 && (
              <StepWrap>
                <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
                  {accountType === "teacher" ? "Your teaching profile" : "Tell us about yourself"}
                </h1>
                <p className="text-muted-foreground mt-2">
                  {accountType === "teacher" ? "Help students find the right teacher" : "We'll personalise your experience"}
                </p>

                <div className="mt-8 space-y-6">
                  <div>
                    <label className="text-sm font-medium">{accountType === "teacher" ? "School or institution" : "Your school"}</label>
                    <Input
                      value={school}
                      onChange={(e) => setSchool(e.target.value.slice(0, 120))}
                      className="mt-1.5"
                      placeholder={accountType === "teacher" ? "Where do you teach?" : "e.g. Makerere College School"}
                    />
                  </div>

                  {accountType === "student" && (
                    <div>
                      <label className="text-sm font-medium">Your grade</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {GRADES.map((g) => (
                          <Pill key={g} selected={grade === g} onClick={() => setGrade(g)}>{g}</Pill>
                        ))}
                      </div>
                    </div>
                  )}

                  {accountType === "teacher" && (
                    <div>
                      <label className="text-sm font-medium">Teaching experience</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {EXPERIENCE.map((e) => (
                          <Pill key={e} selected={experience === e} onClick={() => setExperience(e)}>{e}</Pill>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">
                      {accountType === "teacher" ? "Subjects you teach" : "Subjects of interest"}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">Select at least one</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {SUBJECTS.map((s) => (
                        <Pill key={s} selected={subjects.includes(s)} onClick={() => toggleSubject(s)}>{s}</Pill>
                      ))}
                    </div>
                  </div>

                  {accountType === "teacher" && (
                    <div className="rounded-xl border border-border bg-primary/5 p-4 flex gap-3">
                      <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-semibold">Teacher Verification</div>
                        <p className="text-muted-foreground text-xs mt-1">
                          Complete setup now. Apply for the Verified Teacher badge after — verified teachers get more visibility.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <Footer onBack={() => setStep(1)} onNext={finish} nextLabel={busy ? "Saving…" : "Finish Setup"} nextDisabled={!canFinishStep2 || busy} />
              </StepWrap>
            )}

            {step === 3 && (
              <StepWrap>
                <div className="text-center py-10">
                  <SuccessCheck />
                  <h1 className="mt-6 text-3xl md:text-4xl font-display font-bold">
                    You're all set, @{username}! 🎉
                  </h1>
                  <p className="text-muted-foreground mt-2">
                    {accountType === "teacher" ? "Your teaching journey starts now." : "Your learning journey starts now."}
                  </p>
                  <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                    <Button size="lg" onClick={() => navigate({ to: "/dashboard-route", replace: true })}>
                      Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    {accountType === "teacher" && (
                      <Button size="lg" variant="outline" onClick={async () => {
                        if (!user) return;
                        await supabase.from("teacher_verifications").insert({ user_id: user.id, message: "Initial request from onboarding" });
                        toast.success("Verification request submitted");
                        navigate({ to: "/dashboard-route", replace: true });
                      }}>
                        Apply for Verification <Sparkles className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </StepWrap>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-xl p-6 md:p-10 animate-in fade-in slide-in-from-right-4 duration-300">
      {children}
    </div>
  );
}

function RoleCard({ selected, onClick, icon, color, title, description }: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; color: "emerald" | "sky"; title: string; description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group text-left rounded-2xl border-2 p-6 transition-all hover:shadow-lg",
        selected
          ? color === "emerald"
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-sky-500 bg-sky-500/10"
          : "border-border bg-muted/30 hover:border-muted-foreground/40",
      )}
    >
      <div className={cn(
        "h-14 w-14 rounded-2xl grid place-items-center mb-4 transition-colors",
        color === "emerald" ? "bg-emerald-500/15 text-emerald-500" : "bg-sky-500/15 text-sky-500",
      )}>
        {icon}
      </div>
      <div className="font-display font-bold text-lg">{title}</div>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
      {selected && (
        <div className={cn("mt-3 inline-flex items-center gap-1 text-xs font-medium", color === "emerald" ? "text-emerald-500" : "text-sky-500")}>
          <Check className="h-3.5 w-3.5" /> Selected
        </div>
      )}
    </button>
  );
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-full text-sm font-medium transition-all border min-h-[44px]",
        selected ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-muted/40 border-border text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Footer({ onBack, onNext, nextDisabled, nextLabel = "Continue" }: {
  onBack?: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-8">
      {onBack ? <Button variant="ghost" onClick={onBack}>Back</Button> : <span />}
      <Button size="lg" onClick={onNext} disabled={nextDisabled} className="min-w-[140px]">
        {nextLabel} <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function SuccessCheck() {
  return (
    <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/15 grid place-items-center animate-in zoom-in-50 duration-500">
      <svg viewBox="0 0 24 24" className="h-12 w-12 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: "draw 0.6s 0.2s ease-out forwards" }} />
      </svg>
      <style>{`@keyframes draw { to { stroke-dashoffset: 0; } }`}</style>
    </div>
  );
}
