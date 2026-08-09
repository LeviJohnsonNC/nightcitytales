import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, signInWithPassword, signUpWithPassword } from "@/lib/backend";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Night City Tales" },
      {
        name: "description",
        content: "Sign in with email and password or a magic link to reach your character roster.",
      },
      { property: "og:title", content: "Sign In — Night City Tales" },
      {
        property: "og:description",
        content: "Sign in with email and password or a magic link to reach your character roster.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
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

  const onSignIn = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await signInWithPassword(email, password);
      await navigate({ to: "/roster" });
    });
  };

  const onSignUp = () =>
    void run(async () => {
      const { needsEmailConfirmation } = await signUpWithPassword(email, password);
      if (needsEmailConfirmation) setMessage("Check your email to confirm your account.");
      else await navigate({ to: "/roster" });
    });

  const onMagicLink = () =>
    void run(async () => {
      await sendMagicLink(email);
      setMessage("Magic link sent. Check your email.");
    });

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <form
        onSubmit={onSignIn}
        className="w-full max-w-sm space-y-5 border border-hairline bg-surface p-7"
      >
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ember">
            Night City Tales
          </p>
          <h1 className="text-2xl text-text">Sign in</h1>
          <p className="text-sm text-text-muted">
            Email and password, or a magic link if you prefer.
          </p>
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="border-l-2 border-danger pl-3 text-sm text-text">{error}</p>
        )}
        {message && (
          <p className="border-l-2 border-success pl-3 text-sm text-text-muted">{message}</p>
        )}

        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={busy}>
            Sign in
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={onSignUp}>
            Create account
          </Button>
          <Button type="button" variant="ghost" disabled={busy || !email} onClick={onMagicLink}>
            Email me a magic link
          </Button>
        </div>
      </form>
    </main>
  );
}