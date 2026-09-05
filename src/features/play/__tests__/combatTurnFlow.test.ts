import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayBundle } from "../usePlay";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import {
  EMPTY_TURN_ECONOMY,
  NIGHT_AT_THE_OPERA,
  startMission,
  type CapabilitySnapshot,
  type PerformAttackResult,
} from "@/engine";

const io = vi.hoisted(() => ({
  latest: null as unknown,
  inventory: [] as { id: string; slot: string; item_id: string; ammo_loaded: number }[],
  events: [] as Record<string, unknown>[],
  save: vi.fn(),
  npc: vi.fn(),
  narrate: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@/lib/backend", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCampaign: vi.fn(async () => ({
    vitals: { hp_current: 30, wound_state: "none" },
    inventory: io.inventory,
  })),
  appendCampaignEvent: vi.fn(async (event: Record<string, unknown>) => {
    io.events.push(event);
    return event;
  }),
  listCampaignEvents: vi.fn(async () => io.events),
}));
vi.mock("@/features/campaign/encounterState", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveLiveEncounter: (live: LiveEncounter, ammo?: { inventoryId: string; loaded: number }) => {
    io.save(live);
    if (ammo)
      io.inventory = io.inventory.map((r) =>
        r.id === ammo.inventoryId ? { ...r, ammo_loaded: ammo.loaded } : r,
      );
    io.latest = { ...live, version: live.version + 1 };
    return Promise.resolve(io.latest);
  },
}));
vi.mock("../combatFlow", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  runNpcTurns: async (_campaign: string, _beat: string, live: LiveEncounter) => {
    io.npc(live);
    return { live: { ...live, state: { ...live.state, round: live.state.round + 1 } }, lines: [] };
  },
  settleNpcTurns: async () => ({ status: "", owed: false }),
  closeOutFight: async () => {
    io.close();
    return "Finished";
  },
}));
vi.mock("@/features/campaign/combatLog", () => ({
  logAttack: vi.fn(),
  logSkillCheck: vi.fn(),
  logOpposedCheck: vi.fn(),
  logCoverDamage: vi.fn(),
  logDeathSave: vi.fn(),
  logMorale: vi.fn(),
}));
vi.mock("@/features/gm/gmTurn.server", () => ({
  gmTurnFn: async () => {
    io.narrate();
    // A fixed-result response must not be able to start the next action or change state.
    return {
      narration: "The guard misses.",
      proposedActions: [{ kind: "move", targetId: "h", towards: "closer" }],
      stateDeltas: [{ kind: "set_flag", flag: "bad" }],
      observations: [],
      suggestedActions: ["Shoot again"],
      question: null,
    };
  },
}));
vi.mock("@/features/campaign/skillCheckLog", () => ({
  logSkillCheck: vi.fn(),
  logOpposedCheck: vi.fn(),
}));
vi.mock("@/features/campaign/shopping", () => ({
  reloadWeapon: async () => {
    io.inventory[0]!.ammo_loaded = 8;
    return { ok: true };
  },
}));
// Use the real turn adapter; keep this fixture independent of character-creation data.
vi.mock("../capabilityModel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../capabilityModel")>();
  return {
    ...actual,
    buildCapabilitySnapshot: ({ encounter, inventory }: PlayBundle) => ({
      ...capability(),
      weapons: [{ ...capability().weapons[0]!, roundsLoaded: inventory[0]?.ammo_loaded ?? 8 }],
      turn: actual.turnEconomy(encounter, 8),
    }),
  };
});

function capability(): CapabilitySnapshot {
  return {
    hp: 30,
    hpMax: 30,
    woundState: "none",
    incapacitated: false,
    move: 8,
    luck: 0,
    eurobucks: 0,
    items: [],
    cyberware: [],
    roleAbility: null,
    failedAttempts: [],
    weapons: [
      {
        itemId: "heavy_pistol",
        name: "Heavy Pistol",
        melee: false,
        rof: 2,
        roundsLoaded: 8,
        magazine: 8,
        spareRounds: 8,
        rangeType: "pistol",
        damageDice: 3,
        broken: false,
      },
    ],
    targets: [
      { id: "h", key: "h", name: "Guard", defeated: false, perceivable: true, distance: 12 },
    ],
    turn: { ...EMPTY_TURN_ECONOMY, inCombat: true, isPlayerTurn: true, move: 8 },
  };
}
let counter = 0;
function bundle(): PlayBundle {
  const p = {
    id: "p",
    name: "Red",
    isPlayer: true,
    hp: 30,
    hpMax: 30,
    woundState: "none",
    defeated: false,
  };
  return {
    campaign: { id: "c", day: 1, minute: 0, role_state: {}, location_key: null },
    character: { character: { name: "Red", role: "solo" }, stats: {}, skills: [], gear: [] },
    vitals: {
      hp_current: 30,
      hp_max: 30,
      wound_state: "none",
      eurobucks: 0,
      humanity_current: 40,
      humanity_max: 40,
    },
    inventory: io.inventory,
    cyberware: [],
    events: [],
    npcs: [],
    pressure: [],
    standings: [],
    factionStandings: [],
    tally: {},
    mission: NIGHT_AT_THE_OPERA,
    runtime: startMission(NIGHT_AT_THE_OPERA),
    beat: NIGHT_AT_THE_OPERA.beats[0],
    availableExits: [],
    complication: null,
    encounter: {
      id: `enc-${counter++}`,
      version: 0,
      arena: "open_ground",
      cover: {},
      state: {
        status: "active",
        round: 1,
        order: ["p", "h"],
        activeIndex: 0,
        combatants: { p, h: { ...p, id: "h", name: "Guard", isPlayer: false, side: "hostile" } },
      },
      data: {
        p: { key: "p", position: { x: 2, y: 2 }, move: 8 },
        h: { key: "h", position: { x: 2, y: 14 }, move: 6 },
      },
    },
  } as unknown as PlayBundle;
}
const {
  commitAttack,
  commitBoardMove,
  commitReload,
  commitCheck,
  endPlayerTurn,
  finishCombatAction,
} = await import("../usePlay");
const { attackOption, pendingAttackFrom } = await import("../attackPrompt");

async function shoot(b: PlayBundle) {
  const pending = pendingAttackFrom(
    [{ type: "attack_prompt", data: { targetId: "h" } } as never],
    b.character,
    b.encounter,
    b.inventory,
  )!;
  const option = attackOption(pending, pending.weapons[0]!, b.character, capability());
  const result = {
    state: b.encounter!.state,
    attack: { hit: false, formula: "Miss", total: 8, dv: 15, rolls: [1] },
    damage: null,
    applied: null,
  } as unknown as PerformAttackResult;
  await commitAttack(b, pending, option, result);
}
beforeEach(() => {
  vi.clearAllMocks();
  io.events = [];
  io.latest = null;
  io.inventory = [{ id: "gun", item_id: "heavy_pistol", slot: "weapon", ammo_loaded: 8 }];
});

describe("shipping turn orchestration", () => {
  it("shoots without handing over or asking the GM for the next action", async () => {
    await shoot(bundle());
    expect(io.npc).not.toHaveBeenCalled();
    expect(io.narrate).not.toHaveBeenCalled();
    expect((io.latest as LiveEncounter).data["p"]!.turn).toMatchObject({
      shotsThisRound: 1,
      actionUsed: true,
      metresMoved: 0,
    });
    expect(io.inventory[0]!.ammo_loaded).toBe(7);
  });
  it("rejects a rolled shot if the encounter changed after its preview", async () => {
    const b = bundle();
    const pending = pendingAttackFrom(
      [{ type: "attack_prompt", data: { targetId: "h" } } as never],
      b.character,
      b.encounter,
      b.inventory,
    )!;
    const option = attackOption(pending, pending.weapons[0]!, b.character, capability());
    b.encounter = { ...b.encounter!, version: 1 };
    await expect(commitAttack(b, pending, option, {} as PerformAttackResult)).rejects.toThrow();
    expect(io.save).not.toHaveBeenCalled();
  });
  it("cancels only the named shot preview without resurrecting an older prompt", () => {
    const b = bundle();
    const events = [
      { id: "older", type: "attack_prompt", data: { targetId: "h" } },
      { id: "chosen", type: "attack_prompt", data: { targetId: "h" } },
      { id: "cancel", type: "attack_cancelled", data: { promptId: "chosen" } },
    ];
    expect(pendingAttackFrom(events as never, b.character, b.encounter, b.inventory)).toBeNull();
    events[2]!.data = { promptId: "older" };
    expect(pendingAttackFrom(events as never, b.character, b.encounter, b.inventory)?.eventId).toBe(
      "chosen",
    );
  });
  it("discards an unrolled attack when its turn ends", () => {
    const b = bundle();
    expect(
      pendingAttackFrom(
        [
          { type: "attack_prompt", data: { targetId: "h" } },
          { type: "turn_ended", data: {} },
        ] as never,
        b.character,
        b.encounter,
        b.inventory,
      ),
    ).toBeNull();
  });
  it("keeps the second shot after moving, then hands over exactly when it is spent", async () => {
    const b = bundle();
    await commitBoardMove(b, { x: 2, y: 6 });
    b.encounter = io.latest as LiveEncounter;
    await shoot(b);
    expect(io.npc).not.toHaveBeenCalled();
    b.encounter = io.latest as LiveEncounter;
    b.inventory = io.inventory as never;
    await shoot(b);
    expect(io.npc).toHaveBeenCalledOnce();
    expect(io.narrate).not.toHaveBeenCalled();
    expect(io.events.some((e) => e["type"] === "combat_exchange")).toBe(true);
  });
  it("lets the player move after both shots, then hands over", async () => {
    const b = bundle();
    await shoot(b);
    b.encounter = io.latest as LiveEncounter;
    b.inventory = io.inventory as never;
    await shoot(b);
    expect(io.npc).not.toHaveBeenCalled();
    b.encounter = io.latest as LiveEncounter;
    await commitBoardMove(b, { x: 2, y: 6 });
    expect(io.npc).toHaveBeenCalledOnce();
  });
  it("ends explicitly even with unused choices, and duplicate handoff does not run enemies twice", async () => {
    const b = bundle();
    await endPlayerTurn(b);
    await endPlayerTurn(b);
    expect(io.npc).toHaveBeenCalledOnce();
  });
  it("does not skip somebody else's turn", async () => {
    const b = bundle();
    b.encounter!.state.activeIndex = 1;
    await endPlayerTurn(b);
    expect(io.npc).not.toHaveBeenCalled();
  });
  it("reloads without losing the Move, then hands over when the Move is used", async () => {
    io.inventory[0]!.ammo_loaded = 0;
    const b = bundle();
    await commitReload(b, "heavy_pistol");
    expect(io.npc).not.toHaveBeenCalled();
    b.encounter = io.latest as LiveEncounter;
    await commitBoardMove(b, { x: 2, y: 6 });
    expect(io.npc).toHaveBeenCalledOnce();
  });
  it("spends a freeform check's Action while preserving movement", async () => {
    const b = bundle();
    await commitCheck(
      b,
      {
        skillId: "athletics",
        skillName: "Athletics",
        intent: "pull the lever",
        dv: 13,
        beatId: null,
      } as never,
      {
        kind: "skill",
        luckSpent: 0,
        result: { success: true, total: 15, formula: "15 vs 13", critical: null },
      } as never,
    );
    expect((io.latest as LiveEncounter).data["p"]!.turn).toMatchObject({
      actionUsed: true,
      shotsThisRound: 0,
    });
    expect(io.npc).not.toHaveBeenCalled();
    b.encounter = io.latest as LiveEncounter;
    await expect(
      commitCheck(
        b,
        { skillId: "athletics", intent: "do another thing" } as never,
        { kind: "skill", luckSpent: 0 } as never,
      ),
    ).rejects.toThrow("already spent");
  });
  it("closes a won fight without handing over to enemies", async () => {
    const b = bundle();
    b.encounter!.state.status = "friendlies_won";
    await finishCombatAction(b, b.encounter!, null);
    expect(io.close).toHaveBeenCalledOnce();
    expect(io.npc).not.toHaveBeenCalled();
  });
});
