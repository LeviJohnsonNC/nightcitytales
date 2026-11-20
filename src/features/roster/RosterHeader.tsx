import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/backend";

export function RosterHeader() {
  const logout = useMutation({
    mutationFn: signOut,
    // A fresh page drops in-memory account data before someone else signs in.
    onSuccess: () => window.location.replace("/login"),
  });

  return (
    <header className="flex animate-[fade-in_.5s_both] flex-wrap items-end justify-between gap-4 motion-reduce:animate-none">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-text drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)] sm:text-5xl">
          Your Roster
        </h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-text-muted">
          Choose a life to return to
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/create"
          className="group flex items-center gap-2 border border-ember/60 bg-ember/10 px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-ember transition-colors hover:bg-ember hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New Character
        </Link>
        <Button
          type="button"
          variant="secondary"
          className="h-10"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          <LogOut aria-hidden />
          {logout.isPending ? "Signing out…" : "Sign out"}
        </Button>
      </div>
      {logout.isError && (
        <p role="alert" className="basis-full text-sm text-danger">
          Couldn’t sign out. Please try again.
        </p>
      )}
    </header>
  );
}
