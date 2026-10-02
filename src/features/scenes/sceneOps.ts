import {
  readPersistentScene,
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
    ...(effects ? { roleEffects: effects } : {}),
    goal: "repel",
  });
}
