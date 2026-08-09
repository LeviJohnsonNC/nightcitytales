import { createFileRoute, Link } from "@tanstack/react-router";
import { RosterList } from "@/features/roster/RosterList";

export const Route = createFileRoute("/_authenticated/roster")({
  head: () => ({
    meta: [
      { title: "Your Roster — Night City Tales" },
      { name: "description", content: "Every edgerunner you have created, saved to your account." },
      { property: "og:title", content: "Your Roster — Night City Tales" },
      {
        property: "og:description",
        content: "Every edgerunner you have created, saved to your account.",
      },
    ],
  }),
  component: RosterPage,
});

function RosterPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">Your roster</h1>
      <RosterList />
      <Link to="/create" className="text-sm underline underline-offset-4">
        Create a character
      </Link>
    </main>
  );
}