import { createFileRoute, useParams } from "@tanstack/react-router";

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
  const { id } = useParams({ from: "/_authenticated/character/$id" });
  return (
    <main className="mx-auto max-w-3xl space-y-2 px-6 py-12">
      <h1 className="text-2xl font-semibold">Character sheet</h1>
      <p className="text-sm text-muted-foreground">Character {id} — sheet UI not built yet.</p>
    </main>
  );
}