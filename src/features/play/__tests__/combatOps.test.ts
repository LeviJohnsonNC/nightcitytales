import { describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({
  campaign: {
    campaign: {
      id: "c",
      character_id: "pc",
      phase: "life",
      current_mission_id: null,
      role_state: {},
    },
    vitals: { hp_current: 30, hp_max: 40, wound_state: "none" },
    inventory: [],
    cyberware: [],
  },
  character: { character: { name: "Red", role: "solo" }, stats: {}, skills: [], gear: [] },
}));
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<object>()),
  getCampaign: vi.fn(async () => io.campaign),
  getCharacter: vi.fn(async () => io.character),
  listCampaignEvents: vi.fn(async () => []),
}));
vi.mock("@/features/campaign/encounterState", async (original) => ({
  ...(await original<object>()),
  loadLiveEncounter: vi.fn(async () => null),
}));

import { loadCombat, snapshotFor } from "../combatOps";

describe("combat without a Job", () => {
  it("loads campaign capabilities without constructing a mission or beat", async () => {
    const bundle = await loadCombat("c");
    expect(bundle.beat).toBeNull();
    expect(bundle.campaign.phase).toBe("life");
    expect(bundle.character.character.name).toBe("Red");
    expect(snapshotFor(bundle).hp).toBe(30);
    expect(bundle).not.toHaveProperty("mission");
  });
});
