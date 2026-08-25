import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlayScreen } from "@/features/play/PlayScreen";
import { LifeScreen } from "@/features/life/LifeScreen";
import { getCampaign } from "@/lib/backend";
import { phaseOf } from "@/engine";

export const Route = createFileRoute("/_authenticated/play/$id")({
  head: () => ({
    meta: [
      { title: "Play · Night City Tales" },
      { name: "description", content: "Run your edgerunner through a Night City job." },
    ],
  }),
  component: PlayPage,
});

/**
 * The application — never the AI — decides which screen the campaign is on.
 * Life owns everything between jobs; the job machinery only takes the screen
 * once the player has accepted a hook.
 */
function PlayPage() {
  const { id } = Route.useParams();
  const { data, isPending, error } = useQuery({
    queryKey: ["campaign-phase", id],
    queryFn: async () => {
      const full = await getCampaign(id);
      if (!full) throw new Error("Campaign not found.");
      return phaseOf((full.campaign as { phase?: unknown }).phase);
    },
  });

  if (isPending) return <p className="p-8 text-sm text-muted-foreground">Loading the campaign…</p>;
  if (error) return <p className="p-8 text-sm text-destructive">{(error as Error).message}</p>;
  return data === "job" ? <LifeJobBoundary id={id} /> : <LifeScreen campaignId={id} />;
}

function LifeJobBoundary({ id }: { id: string }) {
  return <PlayScreen campaignId={id} />;
}
