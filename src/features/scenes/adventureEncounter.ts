import { composeAdventureScene, readPersistentScene, type SceneFacts } from "@/engine";
import { beginEncounter } from "@/features/play/combatFlow";
import { loadLiveEncounter } from "@/features/campaign/encounterState";
import { stageAdventureScene } from "@/lib/backend";
import { loadCurrentScene } from "./sceneOps";

type Input = Parameters<typeof beginEncounter>[0] & {
  locationKey: string;
  missionId: string;
  sceneFacts?: SceneFacts | undefined;
};
/** Stage once, then enter from the committed snapshot. Model retries never replace saved facts. */
export async function beginAdventureEncounter(input: Input): ReturnType<typeof beginEncounter> {
  const identity = JSON.stringify([input.campaignId, input.missionId, input.beatId]);
  const anchor = `adventure-v1:${identity}`;
  const current = await loadCurrentScene(input.campaignId);
  let saved =
    current?.scene.anchor === anchor && current.scene.locationKey === input.locationKey
      ? current
      : null;
  if (!saved) {
    const scene = composeAdventureScene({
      identity,
      locationKey: input.locationKey,
      name: input.name,
      arena: input.arena,
      facts: input.sceneFacts,
      enemies: input.enemies,
    });
    if (!scene) return beginEncounter(input);
    saved = readPersistentScene(
      await stageAdventureScene(input.campaignId, scene, {
        missionId: input.missionId,
        beatId: input.beatId,
        location: input.locationKey,
      }),
    );
  }
  if (saved.status === "resolved")
    throw new Error(
      "This scene's fight is already finished. Continue the adventure; it cannot respawn.",
    );
  if (saved.status === "combat") {
    const live = await loadLiveEncounter(input.campaignId);
    if (!live || live.id !== saved.encounterId)
      throw new Error("The scene changed. Reload the campaign.");
    return { live, lines: [] };
  }
  return beginEncounter({
    ...input,
    name: saved.scene.layout.arena.label,
    enemies: [],
    scene: saved.scene,
    sceneRef: { id: saved.id, revision: saved.revision },
  });
}
