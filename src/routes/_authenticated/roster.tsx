import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { RosterList } from "@/features/roster/RosterList";
import backdrop from "@/assets/roster-backdrop.png.asset.json";

export const Route = createFileRoute("/_authenticated/roster")({
  head: () => ({
    meta: [
      { title: "Your Roster · Night City Tales" },
      {
        name: "description",
        content: "Every edgerunner you've made, saved to your account and ready to run.",
      },
      { property: "og:title", content: "Your Roster · Night City Tales" },
      {
        property: "og:description",
        content: "Every edgerunner you've made, saved to your account and ready to run.",
      },
    ],
  }),
  component: RosterPage,
});

function RosterPage() {
  const { user } = Route.useRouteContext();
  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backdrop.url})` }}
      />
      <div aria-hidden className="fixed inset-0 z-0 bg-background/80" />
      <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-6 py-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            Your Roster
          </h1>
          <Button asChild>
            <Link to="/create">New Character</Link>
          </Button>
        </header>
        <RosterList userId={user.id} />
      </main>
    </div>
  );
}
