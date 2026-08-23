import { createFileRoute } from "@tanstack/react-router";
import { PlayScreen } from "@/features/play/PlayScreen";

export const Route = createFileRoute("/_authenticated/play/$id")({
  head: () => ({
    meta: [
      { title: "Play · Night City Tales" },
      { name: "description", content: "Run your edgerunner through a Night City job." },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { id } = Route.useParams();
  return <PlayScreen campaignId={id} />;
}
