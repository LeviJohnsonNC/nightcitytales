import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCurrentUser, onAuthChange, signOut, type AuthUser } from "@/lib/backend";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Edgerunner Forge — Cyberpunk RED Character Builder" },
      {
        name: "description",
        content:
          "Roll up Cyberpunk RED characters with a guided wizard and keep your whole roster saved to your account.",
      },
      { property: "og:title", content: "Edgerunner Forge — Cyberpunk RED Character Builder" },
      {
        property: "og:description",
        content:
          "Roll up Cyberpunk RED characters with a guided wizard and keep your whole roster saved to your account.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(setUser);
    void getCurrentUser().then(setUser);
    return unsubscribe;
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Edgerunner Forge</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          A character builder for Cyberpunk RED. Scaffolding is in place — the wizard comes next.
        </p>
      </div>

      {user ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/roster">Go to roster</Link>
            </Button>
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      ) : (
        <Button asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      )}
    </main>
  );
}
