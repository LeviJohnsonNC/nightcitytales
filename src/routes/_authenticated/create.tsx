import { createFileRoute } from "@tanstack/react-router";
import { ChargenWizard } from "@/features/chargen/ChargenWizard";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Create a Character — Night City Tales" },
      {
        name: "description",
        content: "Build a new Cyberpunk RED edgerunner step by step and save them to your roster.",
      },
      { property: "og:title", content: "Create a Character — Night City Tales" },
      {
        property: "og:description",
        content: "Build a new Cyberpunk RED edgerunner step by step and save them to your roster.",
      },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  const { user } = Route.useRouteContext();
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <ChargenWizard userId={user.id} />
    </main>
  );
}