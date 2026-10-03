import {
  readPersistentScene,
  sceneAttackRequest,
  resolveSceneAttack,
  type SceneAttackIntent,
  readSceneManifest,
  type AuthoredScene,
  type PersistentScene,
} from "@/engine";
import {
  getCampaign,
  getCharacter,
  readCampaignScene,
  stageAuthoredScene,
  type Json,
} from "@/lib/backend";
import { beginEncounter } from "@/features/play/combatFlow";
import { combatRoleEffects } from "@/features/play/roleAbilityModel";

export async function stageScene(
  campaignId: string,
  scene: AuthoredScene,
): Promise<PersistentScene> {
  return readPersistentScene(
    await stageAuthoredScene(campaignId, {
      version: 1,
      scene: readSceneManifest({ version: 1, scene }),
    } as unknown as Json),
  );
}
export async function loadCurrentScene(campaignId: string): Promise<PersistentScene | null> {
  const row = await readCampaignScene(campaignId);
  return row == null ? null : readPersistentScene(row);
}
export async function enterSceneCombat(
  campaignId: string,
  sceneId: string,
  revision: number,
  initiatingIntent?: SceneAttackIntent,
): Promise<void> {
  const row = await readCampaignScene(campaignId, sceneId);
  if (!row) throw new Error("You are no longer at this scene.");
  const saved = readPersistentScene(row);
  if (saved.status === "combat") return; // caller reloads the active encounter
  if (saved.status !== "ready" || saved.revision !== revision)
    throw new Error("The scene changed. Reload it before acting.");
  const full = await getCampaign(campaignId);
  if (!full?.vitals) throw new Error("Campaign vitals not found.");
  const character = await getCharacter(full.campaign.character_id);
  if (!character) throw new Error("Character not found.");
  const effects = combatRoleEffects(full.campaign, character);
  await beginEncounter({
    campaignId,
    characterId: full.campaign.character_id,
    beatId: null,
    name: saved.scene.layout.arena.label,
    character,
    vitals: full.vitals,
    inventory: full.inventory,
    enemies: [],
    scene: saved.scene,
    sceneRef: { id: saved.id, revision: saved.revision },
    ...(initiatingIntent ? { initiatingIntent } : {}),
    ...(effects ? { roleEffects: effects } : {}),
    goal: "repel",
  });
}

/** Intercept only explicit supported commands at an already saved scene. */
export async function trySceneAttack(campaignId: string, input: string): Promise<boolean> {
  const request = sceneAttackRequest(input);
  if (!request) return false;
  const saved = await loadCurrentScene(campaignId);
  if (!saved) return false;
  // Adventure scenes are scoped to their beat; the Job route resolves that identity.
  // The latest completed fight at a location must not block a later beat there.
  if (saved.scene.template === "adventure-composition") return false;
  if (saved.status === "resolved")
    throw new Error(
      "This scene’s fight is finished. Starting another fight here is not supported yet.",
    );
  if (saved.status === "combat") return true; // stale adventure tab: reload the existing fight
  const intent = resolveSceneAttack(request, saved.scene);
  await enterSceneCombat(campaignId, saved.id, saved.revision, intent);
  return true;
}
