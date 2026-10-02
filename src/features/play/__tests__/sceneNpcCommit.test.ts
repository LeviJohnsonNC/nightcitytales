import { expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({
  append: vi.fn(),
  save: vi.fn(async (live) => ({ ...live, version: live.version + 1 })),
  publish: vi.fn(),
}));
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<object>()),
  appendCampaignEvent: io.append,
}));
vi.mock("@/features/campaign/encounterState", async (original) => ({
  ...(await original<object>()),
  saveLiveEncounter: io.save,
}));
vi.mock("../combatPlayback", () => ({ publishCombatFrames: io.publish }));
import { runNpcTurns } from "../combatFlow";
import { arenaFor, snapshotBattlefield } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";

function fixture(): LiveEncounter {
  const arena = {
    ...arenaFor("open_ground"),
    playerStart: { x: 3, y: 3 },
    hostileSlots: [{ x: 9, y: 3 }],
    cover: [],
  };
  const actor = {
    ref: 6,
    body: 6,
    hp: 40,
    hpMax: 40,
    seriouslyWoundedThreshold: 20,
    woundState: "none" as const,
    deathSavePenalty: 0,
    spHead: 7,
    spBody: 7,
    defeated: false,
    initiative: 12,
  };
  const stats = {
    weaponName: "Heavy Pistol",
    damageDice: 3,
    rangeType: "pistol",
    move: 6,
    attackSkill: 6,
    threatRole: "mook",
    combatGoal: "kill",
  };
  return {
    id: "fight",
    arena: arena.key,
    layout: snapshotBattlefield(arena),
    origin: { version: 1 },
    cover: {},
    version: 0,
    state: {
      round: 1,
      activeIndex: 0,
      order: ["h", "p"],
      status: "active",
      combatants: {
        h: { ...actor, id: "h", name: "Ganger", side: "hostile", isPlayer: false },
        p: { ...actor, id: "p", name: "Red", side: "friendly", isPlayer: true },
      },
    },
    data: {
      h: { ...stats, key: "ganger", position: arena.hostileSlots[0]! },
      p: { ...stats, key: "player", position: arena.playerStart },
    },
  } as LiveEncounter;
}

it("queues NPC dice traces with their state instead of appending them before a save", async () => {
  vi.clearAllMocks();
  await runNpcTurns("c", null, fixture(), "current");
  expect(io.append).not.toHaveBeenCalled();
  expect(io.save).toHaveBeenCalledWith(expect.anything(), null, [
    expect.objectContaining({ type: "attack" }),
  ]);
  expect(io.publish).toHaveBeenCalledOnce();
});

it("publishes neither ledger rows nor playback when the NPC save is refused", async () => {
  vi.clearAllMocks();
  io.save.mockRejectedValueOnce(new Error("encounter changed"));
  await expect(runNpcTurns("c", null, fixture(), "current")).rejects.toThrow("encounter changed");
  expect(io.append).not.toHaveBeenCalled();
  expect(io.publish).not.toHaveBeenCalled();
});
