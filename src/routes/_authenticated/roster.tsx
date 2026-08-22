import { createFileRoute } from "@tanstack/react-router";
import { RosterList } from "@/features/roster/RosterList";

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
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Your roster</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every edgerunner you've made, plus whatever draft you left on the table.
        </p>
      </header>
      <RosterList userId={user.id} />
    </main>
  );
}
