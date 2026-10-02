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

it("intercepts supported text and carries intent into the same scene entry", async () => {
  const { trySceneAttack } = await import("../sceneOps");
  expect(await trySceneAttack("c", "shoot the rifleman with my pistol")).toBe(true);
  expect(io.begin).toHaveBeenCalledWith(
    expect.objectContaining({
      initiatingIntent: {
        version: 1,
        input: "shoot the rifleman with my pistol",
        targetKey: "rifle_ganger",
        weapon: "pistol",
      },
    }),
  );
});
it("leaves ordinary conversation and unstaged locations in the adventure", async () => {
  const { trySceneAttack } = await import("../sceneOps");
  expect(await trySceneAttack("c", "ask about the neighborhood")).toBe(false);
  expect(io.read).not.toHaveBeenCalled();
  io.read.mockResolvedValue(null);
  expect(await trySceneAttack("c", "open fire")).toBe(false);
  expect(io.begin).not.toHaveBeenCalled();
});
it("does not let a stale adventure tab create a second fight", async () => {
  const { trySceneAttack } = await import("../sceneOps");
  io.read.mockResolvedValue({ ...row(), status: "combat", encounter_id: "e", revision: 1 });
  expect(await trySceneAttack("c", "open fire")).toBe(true);
  expect(io.begin).not.toHaveBeenCalled();
});
it("refuses an invented target without beginning combat", async () => {
  const { trySceneAttack } = await import("../sceneOps");
  await expect(trySceneAttack("c", "shoot the dragon")).rejects.toThrow("Name one person");
  expect(io.begin).not.toHaveBeenCalled();
});

it("does not hand resolved scene attacks to a narrator that could respawn the cast", async () => {
  const { trySceneAttack } = await import("../sceneOps");
  io.read.mockResolvedValue({ ...row(), status: "resolved", encounter_id: "e", revision: 2 });
  await expect(trySceneAttack("c", "open fire")).rejects.toThrow("fight is finished");
  expect(io.begin).not.toHaveBeenCalled();
});
