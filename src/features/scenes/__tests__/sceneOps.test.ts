import { beforeEach, expect, it, vi } from "vitest";
import { northHeywoodScene } from "@/engine";
const io = vi.hoisted(() => ({
  read: vi.fn(),
  campaign: vi.fn(),
  character: vi.fn(),
  begin: vi.fn(),
}));
vi.mock("@/lib/backend", () => ({
  readCampaignScene: io.read,
  getCampaign: io.campaign,
  getCharacter: io.character,
  stageAuthoredScene: vi.fn(),
}));
vi.mock("@/features/play/combatFlow", () => ({ beginEncounter: io.begin }));
vi.mock("@/features/play/roleAbilityModel", () => ({ combatRoleEffects: () => null }));
import { enterSceneCombat } from "../sceneOps";
function row() {
  return {
    id: "scene",
    campaign_id: "c",
    status: "ready",
    revision: 0,
    encounter_id: null,
    summary: null,
    manifest: { version: 1, scene: northHeywoodScene() },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  io.read.mockResolvedValue(row());
  io.campaign.mockResolvedValue({
    campaign: { character_id: "p" },
    vitals: { hp_current: 13 },
    inventory: [],
  });
  io.character.mockResolvedValue({ character: { id: "p" } });
});
it("enters using the saved scene identity and current player vitals", async () => {
  const saved = row();
  saved.manifest.scene.actors[0]!.name = "Saved rifleman";
  io.read.mockResolvedValue(saved);
  await enterSceneCombat("c", "scene", 0);
  expect(io.begin).toHaveBeenCalledWith(
    expect.objectContaining({
      scene: saved.manifest.scene,
      sceneRef: { id: "scene", revision: 0 },
      vitals: { hp_current: 13 },
      beatId: null,
    }),
  );
});
it("does not respawn a completed scene", async () => {
  io.read.mockResolvedValue({
    ...row(),
    status: "resolved",
    revision: 2,
    encounter_id: "e",
    summary: "The lookout withdrew.",
  });
  await expect(enterSceneCombat("c", "scene", 0)).rejects.toThrow("scene changed");
  expect(io.begin).not.toHaveBeenCalled();
});
it("refuses a stale scene revision before rolling initiative", async () => {
  await expect(enterSceneCombat("c", "scene", 1)).rejects.toThrow("scene changed");
  expect(io.begin).not.toHaveBeenCalled();
});
it("refuses entry after leaving the scene", async () => {
  io.read.mockResolvedValue(null);
  await expect(enterSceneCombat("c", "scene", 0)).rejects.toThrow("no longer");
  expect(io.begin).not.toHaveBeenCalled();
});
