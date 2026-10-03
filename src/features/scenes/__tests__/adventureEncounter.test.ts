import { beforeEach, expect, it, vi } from "vitest";
import { composeAdventureScene, readSceneFacts } from "@/engine";
const io = vi.hoisted(() => ({ read: vi.fn(), stage: vi.fn(), begin: vi.fn(), live: vi.fn() }));
vi.mock("../sceneOps", () => ({ loadCurrentScene: io.read }));
vi.mock("@/lib/backend", () => ({ stageAdventureScene: io.stage }));
vi.mock("@/features/play/combatFlow", () => ({ beginEncounter: io.begin }));
vi.mock("@/features/campaign/encounterState", () => ({ loadLiveEncounter: io.live }));
import { beginAdventureEncounter } from "../adventureEncounter";
const enemies = [{ key: "guard", name: "Mara", profile: "street_thug" }];
const input = {
  campaignId: "c",
  characterId: "p",
  beatId: "climax",
  missionId: "job",
  locationKey: "north_heywood",
  name: "Office fight",
  arena: "warehouse",
  enemies,
  character: {} as never,
  vitals: {} as never,
};
const scene = () =>
  composeAdventureScene({
    locationKey: input.locationKey,
    identity: JSON.stringify(["c", "job", "climax"]),
    name: input.name,
    arena: input.arena,
    enemies,
  })!;
beforeEach(() => {
  vi.clearAllMocks();
  io.read.mockResolvedValue(null);
  io.stage.mockImplementation(async (_id, scene) => ({
    id: "saved",
    campaign_id: "c",
    revision: 0,
    status: "ready",
    encounter_id: null,
    summary: null,
    manifest: { version: 1, scene },
  }));
  io.begin.mockResolvedValue({ live: { id: "fight" }, lines: [] });
});
it("stages at the expected beat and enters using the committed snapshot", async () => {
  await beginAdventureEncounter(input);
  expect(io.stage).toHaveBeenCalledWith(
    "c",
    expect.objectContaining({ template: "adventure-composition" }),
    { missionId: "job", beatId: "climax", location: "north_heywood" },
  );
  expect(io.begin).toHaveBeenCalledWith(
    expect.objectContaining({
      sceneRef: { id: "saved", revision: 0 },
      enemies: [],
      beatId: "climax",
      scene: expect.objectContaining({ actors: [expect.objectContaining({ name: "Mara" })] }),
    }),
  );
});
it("reuses saved facts even when the model changes its proposal", async () => {
  const saved = scene();
  io.read.mockResolvedValue({ id: "saved", status: "ready", revision: 0, scene: saved });
  await beginAdventureEncounter({
    ...input,
    sceneFacts: readSceneFacts({ locationType: "garage" }),
  });
  expect(io.stage).not.toHaveBeenCalled();
  expect(io.begin.mock.calls[0]![0].scene).toEqual(saved);
});
it("does not respawn a resolved beat", async () => {
  io.read.mockResolvedValue({ status: "resolved", scene: scene() });
  await expect(beginAdventureEncounter(input)).rejects.toThrow("already finished");
  expect(io.begin).not.toHaveBeenCalled();
});
it("returns an already engaged encounter without rolling or acting again", async () => {
  io.read.mockResolvedValue({ status: "combat", encounterId: "fight", scene: scene() });
  io.live.mockResolvedValue({ id: "fight" });
  expect(await beginAdventureEncounter(input)).toEqual({ live: { id: "fight" }, lines: [] });
  expect(io.begin).not.toHaveBeenCalled();
});
it("does not enter when guarded staging rejects a stale location", async () => {
  io.stage.mockRejectedValue(new Error("adventure scene origin changed"));
  await expect(beginAdventureEncounter(input)).rejects.toThrow("origin changed");
  expect(io.begin).not.toHaveBeenCalled();
});
it("preserves unsupported authored fights", async () => {
  await beginAdventureEncounter({ ...input, arena: "rooftop" });
  expect(io.stage).not.toHaveBeenCalled();
  expect(io.begin).toHaveBeenCalledWith({ ...input, arena: "rooftop" });
});
