import { createFileRoute } from "@tanstack/react-router";
import { RosterList } from "@/features/roster/RosterList";
import { RosterHeader } from "@/features/roster/RosterHeader";
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
      {/* The city itself: kept legible, graded only where the UI sits on top. */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backdrop.url})` }}
      />
      <div
        aria-hidden
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, var(--color-ground) 42%, transparent), color-mix(in oklab, var(--color-ground) 86%, transparent) 62%, var(--color-ground) 100%)",
        }}
      />
      <div
        aria-hidden
        className="fixed inset-x-0 bottom-0 z-0 h-1/2 bg-[linear-gradient(to_top,var(--color-ground),transparent)]"
      />

      <main className="relative z-10 mx-auto max-w-[1400px] space-y-10 px-6 py-14 lg:px-10">
        <RosterHeader />
        <RosterList userId={user.id} />
      </main>
    </div>
  );
}
