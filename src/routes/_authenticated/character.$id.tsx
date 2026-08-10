import { createFileRoute } from "@tanstack/react-router";
import { CharacterDetail } from "@/features/roster/CharacterDetail";

export const Route = createFileRoute("/_authenticated/character/$id")({
  head: () => ({
    meta: [
      { title: "Character Sheet — Night City Tales" },
      { name: "description", content: "View and manage one of your saved edgerunners." },
      { property: "og:title", content: "Character Sheet — Night City Tales" },
      {
        property: "og:description",
        content: "View and manage one of your saved edgerunners.",
      },
    ],
  }),
  component: CharacterPage,
});

function CharacterPage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <CharacterDetail id={id} userId={user.id} />
    </main>
  );
}