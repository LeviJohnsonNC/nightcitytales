import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlayScreen } from "@/features/play/PlayScreen";
import { LifeScreen } from "@/features/life/LifeScreen";
import { OpeningScreen } from "@/features/opening/OpeningScreen";
import { needsOpening } from "@/features/opening/openingOps";
import { getCampaign, listCampaignFlags } from "@/lib/backend";
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
      const flags = await listCampaignFlags(id);
      return {
        phase: phaseOf((full.campaign as { phase?: unknown }).phase),
        opening: needsOpening(full.campaign, flags),
      };
    },
  });

  if (isPending) return <p className="p-8 text-sm text-muted-foreground">Loading the campaign…</p>;
  if (error) return <p className="p-8 text-sm text-destructive">{(error as Error).message}</p>;
  // Before anything else: a campaign that has never been opened gets its cold
  // open. Three of the four doors leave it in Life and one puts a job on the
  // table, so this is the only screen that can precede either of the others.
  if (data.opening) return <OpeningScreen campaignId={id} />;
  // Aftermath is still the job's screen: it is where the wrap-up, the I.P.
  // tally and the downtime live, and the player leaves it deliberately.
  const onTheJob = data.phase === "job" || data.phase === "aftermath";
  return onTheJob ? <PlayScreen campaignId={id} /> : <LifeScreen campaignId={id} />;
}
