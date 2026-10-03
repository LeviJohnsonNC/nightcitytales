import { SceneContact } from "@/features/scenes/SceneContact";
import { campaignScreen } from "@/features/play/campaignScreen";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlayScreen } from "@/features/play/PlayScreen";
import { LifeScreen } from "@/features/life/LifeScreen";
import { OpeningScreen } from "@/features/opening/OpeningScreen";
import { Descent } from "@/features/opening/descent/Descent";
import { descentArmed } from "@/features/opening/descent/descentClock";
import { needsOpening } from "@/features/opening/openingOps";
import { useGameMusic } from "@/features/music/useGameMusic";
import { getCampaign, getActiveEncounter, listCampaignFlags } from "@/lib/backend";
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
  // Here, once, rather than on each screen below: Life, a job and the cold open
  // trade places inside this route, and none of those moves should touch the music.
  useGameMusic();
  const { data, isPending, error } = useQuery({
    queryKey: ["campaign-phase", id],
    queryFn: async () => {
      const full = await getCampaign(id);
      if (!full) throw new Error("Campaign not found.");
      const flags = await listCampaignFlags(id);
      return {
        phase: phaseOf((full.campaign as { phase?: unknown }).phase),
        opening: needsOpening(full.campaign, flags),
        combat: Boolean(await getActiveEncounter(id)),
        status: full.campaign.status,
        location: full.campaign.location_key,
      };
    },
  });

  // A player who has just pressed "Enter Night City" is already in the
  // descent; the campaign loading is part of it, not a page of its own.
  if (isPending) {
    return descentArmed() ? (
      <Descent facts={null} ready={false} onDone={() => undefined} />
    ) : (
      <p className="p-8 text-sm text-muted-foreground">Loading the campaign…</p>
    );
  }
  if (error) return <p className="p-8 text-sm text-destructive">{(error as Error).message}</p>;
  // An active fight temporarily owns the screen. Otherwise the original
  // campaign phase (or its cold opening) resumes; combat never changes phase.
  const screen = campaignScreen(data);
  if (screen === "opening") return <OpeningScreen campaignId={id} />;
  const sceneControls =
    !data.combat && data.status === "active" ? (
      <SceneContact campaignId={id} location={data.location} phase={data.phase} />
    ) : null;
  return screen === "play" ? (
    <PlayScreen campaignId={id} sceneControls={sceneControls} />
  ) : (
    <LifeScreen campaignId={id} sceneControls={sceneControls} />
  );
}
