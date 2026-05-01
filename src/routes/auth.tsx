import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GitFork, Mail, Lock, User as UserIcon } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  validateSearch: (s) =>
    z.object({ redirect: z.string().optional() }).parse(s),
  component: AuthPage,
});

const signupSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters").max(72, "Max 72 characters"),
  username: z.string().min(3, "Min 3 chars").max(24, "Max 24 chars").regex(/^[a-z0-9_]+$/, "lowercase letters, digits, _ only"),
  display_name: z.string().min(1, "Required").max(60, "Max 60 chars"),
  role: z.enum(["student", "teacher", "administrator"]),
  school: z.string().max(80, "Max 80 chars").optional(),
  grade: z.string().max(40, "Max 40 chars").optional(),
  subject: z.string().max(80, "Max 80 chars").optional(),
  organization: z.string().max(80, "Max 80 chars").optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const dest = search.redirect && search.redirect.startsWith("/") && !search.redirect.startsWith("/auth") ? search.redirect : "/feed";
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");

  // Signup form
  const [suEmail, setSuEmail] = useState("");
  const [suPwd, setSuPwd] = useState("");
  const [suUsername, setSuUsername] = useState("");
  const [suDisplayName, setSuDisplayName] = useState("");
  const [suRole, setSuRole] = useState<"student" | "teacher" | "administrator">("student");
  const [suSchool, setSuSchool] = useState("");
  const [suGrade, setSuGrade] = useState("");
  const [suSubject, setSuSubject] = useState("");
  const [suOrg, setSuOrg] = useState("");

  // Forgot
  const [forgotEmail, setForgotEmail] = useState("");

  useEffect(() => {
    if (!loading && user) navigate({ to: dest, replace: true });
  }, [user, loading, navigate, dest]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email: loginEmail, password: loginPwd });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPwd });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome back");
    navigate({ to: dest, replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse({
      email: suEmail,
      password: suPwd,
      username: suUsername,
      display_name: suDisplayName || suUsername,
      role: suRole,
      school: suSchool,
      grade: suGrade,
      subject: suSubject,
      organization: suOrg,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    // Role-specific required fields
    if (suRole === "student" && !suSchool.trim()) { toast.error("School is required for students."); return; }
    if (suRole === "teacher" && !suSchool.trim()) { toast.error("School is required for teachers."); return; }
    if (suRole === "administrator" && !suOrg.trim()) { toast.error("Organization is required for administrators."); return; }

    const schoolValue =
      suRole === "administrator" ? suOrg.trim() :
      suRole === "teacher" ? suSchool.trim() :
      suSchool.trim();

    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: suEmail,
      password: suPwd,
      options: {
        emailRedirectTo: `${window.location.origin}/feed`,
        data: {
          username: suUsername,
          display_name: suDisplayName || suUsername,
          account_type: suRole,
          school: schoolValue,
          grade: suRole === "student" ? suGrade.trim() || null : null,
          subject: suRole === "teacher" ? suSubject.trim() || null : null,
        },
      },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created — you're in!");
    navigate({ to: dest, replace: true });
  };

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${dest}` },
    });
    if (error) { setBusy(false); toast.error(error.message); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) { toast.error("Enter your email"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Reset link sent if account exists");
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 rounded-xl bg-primary text-primary-foreground items-center justify-center mb-3">
            <GitFork className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-display font-bold">Welcome to SkillChain</h1>
          <p className="text-sm text-muted-foreground mt-1">Fork knowledge. Build skills together.</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-4">
              <form onSubmit={handleLogin} className="space-y-3">
                <Field label="Email" icon={Mail}>
                  <Input type="email" autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </Field>
                <Field label="Password" icon={Lock}>
                  <Input type="password" autoComplete="current-password" value={loginPwd} onChange={(e) => setLoginPwd(e.target.value)} />
                </Field>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Forgot password?</summary>
                <form onSubmit={handleForgot} className="flex gap-2 mt-2">
                  <Input type="email" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                  <Button type="submit" variant="outline">Send</Button>
                </form>
              </details>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 mt-4">
              <form onSubmit={handleSignup} className="space-y-3">
                <Field label="Username" icon={UserIcon}>
                  <Input value={suUsername} onChange={(e) => setSuUsername(e.target.value.toLowerCase())} placeholder="janedoe" autoComplete="username" />
                </Field>
                <Field label="Email" icon={Mail}>
                  <Input type="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} autoComplete="email" />
                </Field>
                <Field label="Password" icon={Lock}>
                  <Input type="password" value={suPwd} onChange={(e) => setSuPwd(e.target.value)} autoComplete="new-password" />
                </Field>
                <Field label="Account type" icon={UserIcon}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { value: "student", label: "Student", description: "Join as a learner." },
                      { value: "teacher", label: "Teacher", description: "Teach or manage classes." },
                      { value: "administrator", label: "Administrator", description: "Admin dashboard access." },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-xl border px-3 py-3 text-sm transition-colors ${
                          suRole === option.value
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name="accountType"
                          value={option.value}
                          className="sr-only"
                          checked={suRole === option.value}
                          onChange={() => setSuRole(option.value as typeof suRole)}
                        />
                        <div className="font-semibold">{option.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                      </label>
                    ))}
                  </div>
                </Field>
                {suRole === "teacher" && (
                  <Field label="School or organization" icon={UserIcon}>
                    <Input
                      value={suSchool}
                      onChange={(e) => setSuSchool(e.target.value)}
                      placeholder="Oak Valley Academy"
                    />
                  </Field>
                )}
                {suRole === "administrator" && (
                  <Field label="Administrator access code" icon={Lock}>
                    <Input
                      type="password"
                      value={suAdminCode}
                      onChange={(e) => setSuAdminCode(e.target.value)}
                      placeholder="Enter admin invite code"
                    />
                  </Field>
                )}
                <p className="text-xs text-muted-foreground">Min 8 chars. Choose the account type that fits your role.</p>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase font-mono text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-4">
            By continuing, you agree to be a kind and curious citizen of SkillChain.
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          <Link to="/" className="hover:text-primary">← Back to feed</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </Label>
      {children}
    </div>
  );
}
