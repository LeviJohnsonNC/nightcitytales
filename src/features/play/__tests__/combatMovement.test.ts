/**
 * Movement, and the thing it exists to fix.
 *
 * Until this landed the GM wrote a `distance` into its response and the engine
 * read the printed Range DV table with it — so the narrator set the difficulty
 * of every shot in the game, invisibly, while every die stayed honest. These
 * tests pin the replacement: positions the engine placed, distances it
 * measured, and a Move it refuses to let anyone spend twice.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ledger: { type: string; summary: string; data: Record<string, unknown> }[] = [];
const saved: unknown[] = [];

vi.mock("@/lib/backend", () => ({
  appendCampaignEvent: vi.fn(async (row: Record<string, unknown>) => {
    ledger.push({
      type: row["type"] as string,
      summary: row["summary"] as string,
      data: (row["data"] ?? {}) as Record<string, unknown>,
    });
    return row;
  }),
}));

vi.mock("@/features/campaign/encounterState", () => ({
  createLiveEncounter: vi.fn(),
  saveLiveEncounter: vi.fn(async (live: unknown) => {
    saved.push(live);
  }),
}));

vi.mock("@/features/campaign/combatLog", () => ({
  logAttack: vi.fn(async () => {}),
  logDeathSave: vi.fn(async () => {}),
}));

const { MOVE_EVENT, movePlayer, runNpcTurns } = await import("../combatFlow");
const { EMPTY_TURN_ECONOMY, arenaFor, singleShotDV } = await import("@/engine");
import type { LiveEncounter } from "@/features/campaign/encounterState";
import type { CapabilitySnapshot } from "@/engine";
import type { CombatantData } from "../encounterModel";

const ARENA = arenaFor("street");

function fight(over: {
  playerAt?: { x: number; y: number };
  hostileAt?: { x: number; y: number };
  playerMove?: number;
  hostileRange?: string | null;
  round?: number;
  playerTurn?: CombatantData["turn"];
}): LiveEncounter {
  const round = over.round ?? 1;
  return {
    id: "e",
    arena: ARENA.key,
    state: {
      round,
      order: ["p", "h"],
      activeIndex: 0,
      status: "active",
      combatants: {
        p: {
          id: "p",
          name: "Vela",
          side: "friendly",
          isPlayer: true,
          ref: 7,
          body: 6,
          hpMax: 35,
          hp: 35,
          seriouslyWoundedThreshold: 18,
          woundState: "none",
          deathSavePenalty: 0,
          spHead: 7,
          spBody: 7,
          defeated: false,
          initiative: 14,
        },
        h: {
          id: "h",
          name: "Scav",
          side: "hostile",
          isPlayer: false,
          ref: 5,
          body: 5,
          hpMax: 30,
          hp: 30,
          seriouslyWoundedThreshold: 15,
          woundState: "none",
          deathSavePenalty: 0,
          spHead: 7,
          spBody: 7,
          defeated: false,
          initiative: 9,
        },
      },
    },
    data: {
      p: {
        key: "player",
        weaponName: "",
        damageDice: 0,
        rangeType: null,
        position: over.playerAt ?? { ...ARENA.playerStart },
        move: over.playerMove ?? 8,
        attackSkill: 0,
        ...(over.playerTurn ? { turn: over.playerTurn } : {}),
      },
      h: {
        key: "scav_1",
        weaponName: "sidearm",
        damageDice: 2,
        rangeType: over.hostileRange === undefined ? "pistol" : over.hostileRange,
        position: over.hostileAt ?? { x: 15, y: 45 },
        move: 6,
        attackSkill: 4,
      },
    },
  } as unknown as LiveEncounter;
}

const capability = (over: Partial<CapabilitySnapshot> = {}): CapabilitySnapshot =>
  ({
    hp: 35,
    hpMax: 35,
    woundState: "none",
    incapacitated: false,
    eurobucks: 100,
    luck: 3,
    move: 8,
    weapons: [],
    items: [],
    cyberware: [],
    roleAbility: null,
    targets: [],
    turn: { ...EMPTY_TURN_ECONOMY, inCombat: true, move: 8 },
    failedAttempts: [],
    ...over,
  }) as CapabilitySnapshot;

const metres = (live: LiveEncounter) =>
  Math.round(
    Math.hypot(
      live.data["p"]!.position.x - live.data["h"]!.position.x,
      live.data["p"]!.position.y - live.data["h"]!.position.y,
    ),
  );

beforeEach(() => {
  ledger.length = 0;
  saved.length = 0;
});

const move = (live: LiveEncounter, towards: "closer" | "away", cap = capability()) =>
  movePlayer({
    campaignId: "c",
    beatId: null,
    live,
    capability: cap,
    targetId: "h",
    targetName: "Scav",
    towards,
    intent: "breaks for it",
  });

describe("the player moving", () => {
  it("closes the distance by their MOVE", () => {
    const live = fight({});
    const before = metres(live);
    return move(live, "closer").then((result) => {
      expect(metres(result.live)).toBe(before - 8);
      expect(result.refusal).toBeNull();
    });
  });

  it("backs off by their MOVE", async () => {
    // Started up the street rather than on the start line, so there is ground
    // behind them to give: from the edge the arena clamp would eat most of it.
    const live = fight({ playerAt: { x: 15, y: 20 }, hostileAt: { x: 15, y: 60 } });
    const before = metres(live);
    const result = await move(live, "away");
    expect(metres(result.live)).toBe(before + 8);
  });

  it("only spends the metres it actually covered", async () => {
    // Backing into a wall gives 5 m of ground, not the full 8 m Move.
    const live = fight({ playerAt: { x: 15, y: 5 }, hostileAt: { x: 15, y: 45 } });
    const result = await move(live, "away");
    expect(result.live.data["p"]!.position.y).toBe(0);
    expect(result.live.data["p"]!.turn?.metresMoved).toBe(5);
  });

  it("changes the Range DV, which is the entire point", async () => {
    const live = fight({ playerAt: { x: 15, y: 20 }, hostileAt: { x: 15, y: 34 } });
    expect(singleShotDV("pistol", metres(live))).toBe(20); // 14 m
    const result = await move(live, "closer");
    expect(metres(result.live)).toBe(6);
    expect(singleShotDV("pistol", metres(result.live))).toBe(13);
  });

  it("spends the Move out of the Round's economy", async () => {
    const result = await move(fight({}), "closer");
    expect(result.live.data["p"]!.turn).toMatchObject({ round: 1, metresMoved: 8 });
  });

  it("refuses a second Move in the same Round", async () => {
    // The gate in engine/legality.ts has existed since the legality layer
    // shipped and had never been called, because nothing could move.
    const spent = capability({
      turn: { ...EMPTY_TURN_ECONOMY, inCombat: true, move: 8, metresMoved: 8 },
    });
    const result = await move(fight({}), "closer", spent);
    expect(result.refusal?.code).toBe("movement_spent");
    expect(metres(result.live)).toBe(metres(fight({})));
  });

  it("lets them move again next Round", async () => {
    const live = fight({
      round: 2,
      playerTurn: {
        round: 1,
        actionUsed: true,
        shotsThisRound: 1,
        shotWeaponId: "w",
        metresMoved: 8,
      },
    });
    const result = await move(live, "closer");
    expect(result.refusal).toBeNull();
    expect(result.live.data["p"]!.turn).toMatchObject({ round: 2, metresMoved: 8 });
  });

  it("keeps an attack already made this Round when it spends the Move", async () => {
    const live = fight({
      playerTurn: {
        round: 1,
        actionUsed: true,
        shotsThisRound: 1,
        shotWeaponId: "w",
        metresMoved: 0,
      },
    });
    const result = await move(live, "closer");
    expect(result.live.data["p"]!.turn).toMatchObject({
      actionUsed: true,
      shotsThisRound: 1,
      shotWeaponId: "w",
      metresMoved: 8,
    });
  });

  it("cannot walk out of the arena", async () => {
    // Backing off from the far edge of a street with walls on it.
    const live = fight({ playerAt: { x: 15, y: 88 }, hostileAt: { x: 15, y: 40 } });
    const result = await move(live, "away");
    expect(result.live.data["p"]!.position.y).toBeLessThanOrEqual(ARENA.extent.height);
  });

  it("says so rather than silently doing nothing when there is nowhere to go", async () => {
    const live = fight({ playerAt: { x: 15, y: 90 }, hostileAt: { x: 15, y: 40 } });
    const result = await move(live, "away");
    expect(result.refusal?.code).toBe("move_exceeded");
  });

  it("writes what happened to the ledger, in metres", async () => {
    await move(fight({}), "closer");
    const row = ledger.find((e) => e.type === MOVE_EVENT)!;
    expect(row).toBeTruthy();
    expect(row.data["metres"]).toBe(8);
    expect(row.data["from"]).toBe(40);
    expect(row.data["to"]).toBe(32);
  });

  it("persists, so the position survives a reload", async () => {
    await move(fight({}), "closer");
    expect(saved).toHaveLength(1);
  });
});

describe("hostiles moving on their own", () => {
  it("closes on the player when its weapon wants to be nearer", async () => {
    const live = fight({ hostileAt: { x: 15, y: 45 } });
    // The player is at the top of the order, so advanceTurn reaches the hostile.
    const result = await runNpcTurns("c", null, live);
    expect(metres(result.live)).toBeLessThan(40);
    expect(result.lines.some((l) => l.includes("moves"))).toBe(true);
  });

  it("stands still when it is already where it shoots best", async () => {
    const live = fight({ hostileAt: { x: 15, y: 10 } }); // 5 m: inside a pistol's best band
    const result = await runNpcTurns("c", null, live);
    expect(metres(result.live)).toBe(5);
    expect(result.lines.some((l) => l.includes("moves"))).toBe(false);
  });

  it("does not move a hostile with no printed range type", async () => {
    const live = fight({ hostileAt: { x: 15, y: 45 }, hostileRange: null });
    const result = await runNpcTurns("c", null, live);
    expect(metres(result.live)).toBe(40);
  });

  it("moves exactly its own MOVE, not the player's", async () => {
    // The hostile's MOVE is 6 and the player's is 8. A shared constant here
    // would be invisible until somebody with real cyberlegs turned up.
    const live = fight({ hostileAt: { x: 15, y: 45 } });
    const result = await runNpcTurns("c", null, live);
    expect(metres(result.live)).toBe(34);
  });

  it("reports the range it ended at, not the one it started from", async () => {
    // A hostile that closes and then reads its DV from its OLD position would
    // be the same authorship bug wearing a different coat.
    const live = fight({ hostileAt: { x: 15, y: 45 } });
    const result = await runNpcTurns("c", null, live);
    const line = result.lines.find((l) => l.includes("moves"))!;
    expect(line).toContain("34 m from Vela");
  });
});

describe("building a hostile from a profile", () => {
  it("takes every number off the profile, not off the proposal", async () => {
    const { hostileCombatant } = await import("../encounterModel");
    const { threatFor } = await import("@/engine");
    const profile = threatFor("corp_security");
    const built = hostileCombatant(
      { key: "guard_1", name: "Guard", profile: "corp_security" },
      "id",
      { x: 0, y: 0 },
    );
    expect(built.combatant.ref).toBe(profile.ref);
    expect(built.combatant.body).toBe(profile.body);
    expect(built.combatant.hpMax).toBe(profile.hp);
    expect(built.combatant.spBody).toBe(profile.sp);
    expect(built.data.attackSkill).toBe(profile.attackSkill);
    expect(built.data.damageDice).toBe(profile.damageDice);
    expect(built.data.rangeType).toBe(profile.rangeType);
  });

  it("keeps the name the fiction gave them", () => {
    // The model may call a corp guard "Royce". That is fiction, not a stat.
    return import("../encounterModel").then(({ hostileCombatant }) => {
      const built = hostileCombatant(
        { key: "royce", name: "Royce", profile: "corp_security" },
        "id",
        { x: 0, y: 0 },
      );
      expect(built.combatant.name).toBe("Royce");
      expect(built.data.key).toBe("royce");
    });
  });

  it("gives each hostile its own MOVE rather than one constant", async () => {
    // A chromed booster covers 8 m and a renta-cop covers 4. That difference is
    // whether a fight closes on you or stalls at range.
    const { hostileCombatant } = await import("../encounterModel");
    const at = { x: 0, y: 0 };
    const booster = hostileCombatant({ key: "b", name: "B", profile: "booster" }, "1", at);
    const guard = hostileCombatant({ key: "g", name: "G", profile: "corp_security" }, "2", at);
    expect(booster.data.move).toBeGreaterThan(guard.data.move);
  });

  it("builds a street thug out of a profile nobody has heard of", async () => {
    const { hostileCombatant } = await import("../encounterModel");
    const { threatFor } = await import("@/engine");
    const built = hostileCombatant(
      { key: "d", name: "Cyber-Dragon", profile: "cyber_dragon" },
      "id",
      { x: 0, y: 0 },
    );
    expect(built.combatant.hpMax).toBe(threatFor("street_thug").hp);
  });
});
