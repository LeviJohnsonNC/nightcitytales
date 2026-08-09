import { createFileRoute } from "@tanstack/react-router";
import { ChargenWizard } from "@/features/chargen/ChargenWizard";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Create a Character — Edgerunner Forge" },
      {
        name: "description",
        content: "Build a new Cyberpunk RED edgerunner step by step and save them to your roster.",
      },
      { property: "og:title", content: "Create a Character — Edgerunner Forge" },
      {
        property: "og:description",
        content: "Build a new Cyberpunk RED edgerunner step by step and save them to your roster.",
      },
    ],
  }),
  component: () => (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <ChargenWizard />
    </main>
  ),
});