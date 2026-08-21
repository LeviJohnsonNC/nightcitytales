import { createFileRoute } from "@tanstack/react-router";
import { CharacterDetail } from "@/features/roster/CharacterDetail";

export const Route = createFileRoute("/_authenticated/character/$id")({
  head: () => ({
    meta: [
      { title: "Character Sheet · Night City Tales" },
      { name: "description", content: "Pull up one of your saved edgerunners and read the whole sheet, top to bottom." },
      { property: "og:title", content: "Character Sheet · Night City Tales" },
      {
        property: "og:description",
        content: "Pull up one of your saved edgerunners and read the whole sheet, top to bottom.",
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