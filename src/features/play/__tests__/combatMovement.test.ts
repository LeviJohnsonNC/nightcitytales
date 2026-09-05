/**
 * Movement, and the thing it exists to fix.
 *
 * Until this landed the GM wrote a `distance` into its response and the engine
 * read the printed Range DV table with it — so the narrator set the difficulty
 * of every shot in the game, invisibly, while every die stayed honest. These
 * tests pin the replacement: positions the engine placed, distances it
 * measured, and a Move it refuses to let anyone spend twice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  // Returns the encounter it was given, at the next version — the real one
  // advances the token so a multi-save sequence does not refuse its own second
  // write, and callers now use what comes back.
  saveLiveEncounter: vi.fn(async (live: { version?: number }) => {
    saved.push(live);
    return { ...live, version: (live.version ?? 0) + 1 };
  }),
}));

const coverLog: { label: string; applied: number; destroyed: boolean; hit: boolean }[] = [];
const attackLog: string[] = [];

vi.mock("@/features/campaign/combatLog", () => ({
  logAttack: vi.fn(async (_id: string, _parts: unknown, ctx: { targetName: string }) => {
    attackLog.push(ctx.targetName);
  }),
  logCoverDamage: vi.fn(
    async (
      _id: string,
      shot: {
        attack: { hit: boolean };
        hit?: { label: string; applied: number; destroyed: boolean } | null;
      },
    ) => {
      coverLog.push({
        label: shot.hit?.label ?? "(missed)",
        applied: shot.hit?.applied ?? 0,
        destroyed: shot.hit?.destroyed ?? false,
        hit: shot.attack.hit,
      });
    },
  ),
  logDeathSave: vi.fn(async () => {}),
}));

const { MOVE_EVENT, movePlayer, movePlayerTo, runNpcTurns } = await import("../combatFlow");
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
  cover?: Record<string, number>;
  hostileDamage?: number;
  hostileMove?: number;
  /** Who is on the clock. The player is first unless a test says otherwise. */
  order?: string[];
  activeIndex?: number;
}): LiveEncounter {
  const round = over.round ?? 1;
  return {
    id: "e",
    arena: ARENA.key,
    cover: over.cover ?? {},
    version: 0,
    state: {
      round,
      order: over.order ?? ["p", "h"],
      activeIndex: over.activeIndex ?? 0,
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
        damageDice: over.hostileDamage ?? 2,
        rangeType: over.hostileRange === undefined ? "pistol" : over.hostileRange,
        position: over.hostileAt ?? { x: 15, y: 45 },
        move: over.hostileMove ?? 6,
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
  coverLog.length = 0;
  attackLog.length = 0;
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

/**
 * The board's own Move: a point, not a direction. Same gate, same clamp, same
 * economy — the only thing that changes is who chose the destination.
 */
describe("the player moving to a spot on the board", () => {
  const goTo = (live: LiveEncounter, to: { x: number; y: number }, cap = capability()) =>
    movePlayerTo({
      campaignId: "c",
      beatId: null,
      live,
      capability: cap,
      to,
      intent: "moves on the board",
    });

  it("walks to the spot that was picked", async () => {
    const live = fight({ playerAt: { x: 15, y: 20 } });
    const result = await goTo(live, { x: 15, y: 26 });
    expect(result.refusal).toBeNull();
    expect(result.live.data["p"]!.position).toEqual({ x: 15, y: 26 });
    expect(result.live.data["p"]!.turn).toMatchObject({ round: 1, metresMoved: 6 });
  });

  it("refuses a spot further than MOVE rather than stopping short of it", async () => {
    // Silently walking part-way would put them somewhere nobody chose, and the
    // Range DV of every shot afterwards is measured from wherever that is.
    const live = fight({ playerAt: { x: 15, y: 20 } });
    const result = await goTo(live, { x: 15, y: 45 });
    expect(result.refusal?.code).toBe("move_exceeded");
    expect(result.live.data["p"]!.position).toEqual({ x: 15, y: 20 });
  });

  it("refuses a second Move in the same Round", async () => {
    const spent = capability({
      turn: { ...EMPTY_TURN_ECONOMY, inCombat: true, move: 8, metresMoved: 8 },
    });
    const result = await goTo(fight({ playerAt: { x: 15, y: 20 } }), { x: 15, y: 24 }, spent);
    expect(result.refusal?.code).toBe("movement_spent");
  });

  it("does not spend the Action: the Turn still has one", async () => {
    const result = await goTo(fight({ playerAt: { x: 15, y: 20 } }), { x: 15, y: 24 });
    expect(result.live.data["p"]!.turn?.actionUsed).toBe(false);
  });

  it("cannot be clicked outside the arena", async () => {
    const live = fight({ playerAt: { x: 15, y: 3 } });
    const result = await goTo(live, { x: 15, y: -40 });
    expect(result.live.data["p"]!.position.y).toBeGreaterThanOrEqual(0);
  });

  it("persists, and writes the metres to the ledger", async () => {
    await goTo(fight({ playerAt: { x: 15, y: 20 } }), { x: 15, y: 25 });
    expect(saved).toHaveLength(1);
    const row = ledger.find((e) => e.type === MOVE_EVENT)!;
    expect(row.data["metres"]).toBe(5);
  });

  /**
   * Taking cover, which is the half of cover the player could never reach.
   * There is no flag for it and there must not be one: pg. 182 makes cover a
   * question about line of sight, so "in cover" is the answer coverBlocking
   * gives about where you are standing.
   */
  it("reports the cover it put between them, without storing a stance", async () => {
    // The street's parked car sits at x 19.5-23.5, y 36-38. Standing due south
    // of it puts it between the player and a hostile due north.
    const live = fight({ playerAt: { x: 21.5, y: 20 }, hostileAt: { x: 21.5, y: 50 } });
    const result = await goTo(live, { x: 21.5, y: 26 });
    expect(result.refusal).toBeNull();
    const row = ledger.find((e) => e.type === MOVE_EVENT)!;
    expect(row.data["coveredFrom"]).toEqual(["Scav"]);
    expect(row.summary).toContain("no shot either way");
    // Nothing about cover was written onto the combatant: it is a fact about
    // where they are, re-measured, not a state anybody has to remember to clear.
    expect(result.live.data["p"]).not.toHaveProperty("inCover");
  });

  it("says nothing about cover when the line is clear", async () => {
    const live = fight({ playerAt: { x: 5, y: 20 }, hostileAt: { x: 5, y: 50 } });
    await goTo(live, { x: 5, y: 26 });
    const row = ledger.find((e) => e.type === MOVE_EVENT)!;
    expect(row.data["coveredFrom"]).toBeUndefined();
    expect(row.summary).not.toContain("no shot");
  });
});

/**
 * Who acts first.
 *
 * `startEncounter` parks the order on its highest Initiative roll, which is
 * usually not the player. Nothing else advanced it — handOverTheTurn only runs
 * off an action the player takes, and they cannot take one when it is not their
 * turn — so a fight opened on a hostile and STAYED there: the board went inert
 * because the order said so, and the only way out was the GM path, which never
 * checked whose turn it was. beginEncounter now hands over before it returns.
 */
describe("opening the fight on whoever won Initiative", () => {
  it("gives the Turn to a hostile who is on the clock, rather than skipping them", async () => {
    // The hostile is first in the order and has not acted.
    const live = fight({ order: ["h", "p"], activeIndex: 0, hostileAt: { x: 15, y: 20 } });
    const result = await runNpcTurns("c", null, live, "current");
    expect(attackLog.length + coverLog.length).toBeGreaterThan(0);
    // And it stops on the player, whose Turn it now is.
    expect(result.live.state.order[result.live.state.activeIndex]).toBe("p");
  });

  it("skips the combatant on the clock when the player has just acted", async () => {
    // The ordinary case: the order moves OFF the player before anybody acts.
    const live = fight({ order: ["p", "h"], activeIndex: 0, hostileAt: { x: 15, y: 20 } });
    const result = await runNpcTurns("c", null, live, "next");
    expect(result.live.state.order[result.live.state.activeIndex]).toBe("p");
    expect(attackLog.length + coverLog.length).toBeGreaterThan(0);
  });

  it("hands straight back when the player is the one on the clock", async () => {
    // They won Initiative: nobody acts before them.
    const live = fight({ order: ["p", "h"], activeIndex: 0 });
    const result = await runNpcTurns("c", null, live, "current");
    expect(attackLog).toHaveLength(0);
    expect(coverLog).toHaveLength(0);
    expect(result.live.state.activeIndex).toBe(0);
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

/**
 * Cover, from the far side of it.
 *
 * The failure this guards against is a player who steps behind concrete and
 * becomes unkillable: line of sight that refuses shots, with nothing able to
 * break the thing doing the refusing, is worse than no cover at all. Hostiles
 * that cannot reach somebody shoot what is in the way instead, and it goes.
 *
 * "street" carries a parked car at x 19.5-24, y 36-38. Standing either side of
 * it on x = 22 puts it squarely in the line.
 */
describe("cover in a hostile's line", () => {
  /**
   * "street" carries a parked car at y 36-38: a thin-steel door at x 19.5-21.5
   * and a thick-steel engine block at x 21.5-23.5. Standing either side of the
   * engine block on x = 22 puts it squarely in the line.
   */
  const BEHIND = { playerAt: { x: 22, y: 20 }, hostileAt: { x: 22, y: 50 } };

  /**
   * Cover is SHOT AT (CP:R pg. 182), so a hostile can miss it. These tests
   * force the die rather than hoping: `high` always hits, `low` never does.
   */
  const forceRolls = (value: number) => vi.spyOn(Math, "random").mockReturnValue(value);
  const alwaysHits = () => forceRolls(0.99);
  const alwaysMisses = () => forceRolls(0);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shoots the car instead of the person behind it", async () => {
    alwaysHits();
    const { lines } = await runNpcTurns("c", null, fight(BEHIND));
    expect(coverLog).toHaveLength(1);
    expect(coverLog[0]!.label).toBe("the engine block of a parked car");
    // And it is NOT filed as an attack: settlement counts those as people.
    expect(attackLog).toEqual([]);
    expect(lines.join(" ")).toContain("engine block");
  });

  it("can miss the cover, and then nothing happens to it", async () => {
    alwaysMisses();
    const { live } = await runNpcTurns("c", null, fight(BEHIND));
    expect(coverLog).toHaveLength(1);
    expect(coverLog[0]!.hit).toBe(false);
    expect(live.cover).toEqual({});
  });

  it("persists the damage as damage taken, keyed by the piece", async () => {
    alwaysHits();
    const { live } = await runNpcTurns("c", null, fight(BEHIND));
    expect(Object.keys(live.cover)).toEqual(["car_east_engine"]);
    expect(live.cover["car_east_engine"]).toBeGreaterThan(0);
    expect(saved).toHaveLength(1);
  });

  it("accumulates across rounds rather than starting over", async () => {
    alwaysHits();
    // MOVE 0: left to walk, a hostile closes on the car and ends up standing
    // AT it, at which point it is their own cover and stops blocking them.
    const first = await runNpcTurns("c", null, fight({ ...BEHIND, hostileMove: 0 }));
    const second = await runNpcTurns("c", null, {
      ...first.live,
      state: { ...first.live.state, activeIndex: 0 },
    });
    expect(second.live.cover["car_east_engine"]!).toBeGreaterThan(
      first.live.cover["car_east_engine"]!,
    );
  });

  it("shoots the person once the cover is gone", async () => {
    alwaysHits();
    // Thick steel is 50 HP (pg. 182); a piece already shot to bits stops
    // standing in the way.
    const wrecked = fight({ ...BEHIND, cover: { car_east_engine: 50 } });
    await runNpcTurns("c", null, wrecked);
    expect(coverLog).toEqual([]);
    expect(attackLog).toEqual(["Vela"]);
  });

  it("leaves a clear line alone", async () => {
    alwaysHits();
    // The default positions have nothing between them.
    await runNpcTurns("c", null, fight({}));
    expect(coverLog).toEqual([]);
    expect(attackLog).toEqual(["Vela"]);
  });
});

describe("saved combat playback", () => {
  it("publishes enemy actions only after their authoritative save", async () => {
    const { subscribeCombatFrames } = await import("../combatPlayback");
    const { saveLiveEncounter } = await import("@/features/campaign/encounterState");
    const frames: import("../combatPlayback").PlaybackFrame[] = [];
    const stop = subscribeCombatFrames("playback-test", (batch) => frames.push(...batch));
    vi.mocked(saveLiveEncounter).mockImplementationOnce(async (live) => {
      expect(frames).toHaveLength(0);
      return { ...live, version: 1 };
    });
    try {
      await runNpcTurns(
        "playback-test",
        null,
        fight({ hostileAt: { x: 8, y: 28 }, playerAt: { x: 8, y: 2 } }),
      );
      expect(frames[0]?.kind).toBe("turn");
      expect(frames.every((frame) => frame.live.version === 1)).toBe(true);
      const move = frames.find((frame) => frame.kind === "move");
      expect(move).toBeDefined();
      expect(move?.path?.at(-1)).toEqual(move?.live.data["h"]?.position);
      expect(frames.some((frame) => frame.kind === "attack" || frame.kind === "cover")).toBe(true);
    } finally {
      stop();
    }
  });
  it("shows no enemy playback when the encounter save fails", async () => {
    const { subscribeCombatFrames } = await import("../combatPlayback");
    const { saveLiveEncounter } = await import("@/features/campaign/encounterState");
    const listener = vi.fn();
    const stop = subscribeCombatFrames("failed-playback", listener);
    vi.mocked(saveLiveEncounter).mockRejectedValueOnce(new Error("encounter changed"));
    try {
      await expect(runNpcTurns("failed-playback", null, fight({}))).rejects.toThrow(
        "encounter changed",
      );
      expect(listener).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  });
});
