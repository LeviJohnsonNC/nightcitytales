import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithGoogle, signInWithPassword, signUpWithPassword } from "@/lib/backend";
import { pageMeta } from "@/lib/siteMeta";
import loginArt from "@/assets/login-skyline-v2.png.asset.json";

export const Route = createFileRoute("/login")({
  validateSearch: (search): { mode?: "signup" } =>
    search["mode"] === "signup" ? { mode: "signup" } : {},
  head: ({ match }) => ({
    meta: pageMeta({
      title:
        match.search.mode === "signup"
          ? "Create an account · Night City Tales"
          : "Sign In · Night City Tales",
      description:
        "Sign in with your Google account or email and password to reach your character roster.",
      path: "/login",
    }),
  }),
  component: LoginPage,
});

function LoginPage() {
  const { mode } = Route.useSearch();
  return <AccountForm key={mode ?? "signin"} signup={mode === "signup"} />;
}

function AccountForm({ signup }: { signup: boolean }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (signup) {
        const { needsEmailConfirmation } = await signUpWithPassword(email, password);
        if (needsEmailConfirmation) {
          setMessage("Check your email to confirm your account.");
          return;
        }
      } else {
        await signInWithPassword(email, password);
      }
      await navigate({ to: "/roster" });
    });
  };

  const onGoogle = () =>
    void run(async () => {
      const { redirected } = await signInWithGoogle();
      if (redirected) return;
      await navigate({ to: "/roster" });
    });

  return (
    <main className="relative flex min-h-screen items-center justify-start overflow-hidden px-6 py-16">
      {/* Decorative key art. Focal point sits right-of-centre so the figure survives narrow crops. */}
      <img
        src={loginArt.url}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "72% 45%" }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(20,16,19,0.94) 0%, rgba(20,16,19,0.85) 35%, rgba(20,16,19,0.45) 70%, rgba(20,16,19,0.2) 100%)",
        }}
      />
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-sm space-y-5 border border-hairline bg-surface/90 p-7 backdrop-blur-[2px] lg:ml-[8%]"
      >
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ember">
            Night City Tales
          </p>
          <h1 className="text-2xl text-text">{signup ? "Create an account" : "Sign in"}</h1>
          {signup && <p className="text-sm text-text-muted">Save your character and campaign.</p>}
        </div>

        <Button type="button" variant="secondary" disabled={busy} onClick={onGoogle}>
          Continue with Google
        </Button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-hairline" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-text-dim">
            or
          </span>
          <span className="h-px flex-1 bg-hairline" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete={signup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-text">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="border-l-2 border-success pl-3 text-sm text-text-muted">
            {message}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={busy}>
            {signup ? "Create account" : "Sign in"}
          </Button>
          <p className="pt-2 text-center text-sm text-text-muted">
            {signup ? "Already playing? " : "New to Night City? "}
            <Link
              to="/login"
              search={signup ? {} : { mode: "signup" }}
              className="inline-flex min-h-8 items-center font-semibold text-text underline underline-offset-4 hover:text-cool"
            >
              {signup ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
      </form>
    </main>
  );
}
