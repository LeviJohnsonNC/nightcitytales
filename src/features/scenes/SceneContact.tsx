import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { enterSceneCombat, loadCurrentScene } from "./sceneOps";

/** Only scenes explicitly staged by the harness appear here for now. */
export function SceneContact({
  campaignId,
  location,
  phase,
}: {
  campaignId: string;
  location: string | null;
  phase: string;
}) {
  const client = useQueryClient();
  const scene = useQuery({
    queryKey: ["scene", campaignId, location, phase],
    queryFn: () => loadCurrentScene(campaignId),
  });
  const start = useMutation({
    mutationFn: async () => {
      if (!scene.data) throw new Error("Scene is not loaded.");
      await enterSceneCombat(campaignId, scene.data.id, scene.data.revision);
    },
    onSettled: async () => {
      await Promise.all(
        ["scene", "campaign-phase", "play", "life"].map((key) =>
          client.invalidateQueries({ queryKey: [key, campaignId] }),
        ),
      );
    },
  });
  if (scene.isPending) return null;
  if (scene.error)
    return (
      <div className="mx-auto max-w-3xl p-3 text-sm text-destructive">
        Scene controls could not load. <button onClick={() => void scene.refetch()}>Retry</button>
      </div>
    );
  if (!scene.data || scene.data.status === "resolved") return null;
  const saved = scene.data;
  return (
    <section
      aria-label="Scene actions"
      className="flex flex-wrap items-center justify-between gap-3 rounded border border-accent/40 bg-background p-3"
    >
      <div>
        <p className="text-xs text-muted-foreground">
          Name your target with “shoot …”, or type “open fire” to choose on the battlefield.
          Initiative determines who acts first.
        </p>
      </div>
      {saved.status === "ready" && (
        <Button onClick={() => start.mutate()} disabled={start.isPending}>
          {start.isPending ? "Entering combat…" : "Enter combat"}
        </Button>
      )}
      {start.error && (
        <p className="w-full text-sm text-destructive">{(start.error as Error).message}</p>
      )}
    </section>
  );
}
