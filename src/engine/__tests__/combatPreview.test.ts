import { describe, expect, it } from "vitest";
import {
  ATTACK_COST,
  EMPTY_TURN_ECONOMY,
  ONE_ACTION,
  judgeAction,
  previewAttack,
  previewMovement,
  remainingCombatTurn,
  spendCost,
  walkingPath,
  type Arena,
  type CapabilitySnapshot,
  type WeaponCapability,
} from "../index";

const pistol: WeaponCapability = {
  itemId: "heavy_pistol",
  name: "Heavy Pistol",
  melee: false,
  rof: 2,
  magazine: 8,
  roundsLoaded: 8,
  spareRounds: 8,
  rangeType: "pistol",
  damageDice: 3,
  broken: false,
};
const snapshot = (): CapabilitySnapshot => ({
  hp: 30,
  hpMax: 30,
  woundState: "none",
  incapacitated: false,
  eurobucks: 0,
  luck: 0,
  move: 8,
  weapons: [pistol],
  items: [],
  cyberware: [],
  roleAbility: null,
  targets: [{ id: "h", key: "h", name: "Guard", distance: 12, defeated: false, perceivable: true }],
  failedAttempts: [],
  turn: { ...EMPTY_TURN_ECONOMY, inCombat: true, isPlayerTurn: true, move: 8 },
});
const arena: Arena = {
  key: "test",
  label: "test",
  extent: { width: 20, height: 20 },
  playerStart: { x: 2, y: 5 },
  hostileSlots: [],
  cover: [
    {
      id: "wall",
      label: "wall",
      material: "concrete",
      thickness: "thick",
      rect: { x: 4, y: 3, width: 2, height: 4 },
    },
  ],
};
const move = (patch: Partial<Parameters<typeof previewMovement>[0]> = {}) =>
  previewMovement({
    arena,
    cover: {},
    from: { x: 2, y: 5 },
    to: { x: 8, y: 5 },
    capability: snapshot(),
    ...patch,
  });

describe("continuous movement previews", () => {
  it("routes around solid cover and charges the route rather than the straight line", () => {
    const result = move();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toHaveLength(4);
    expect(result.path[0]).toEqual({ x: 2, y: 5 });
    expect(result.position).toEqual({ x: 8, y: 5 });
    expect(result.moved).toBe(8); // round(2*sqrt(8)+2), versus a 6 m straight line
    expect(result.cost.metres).toBe(result.moved);
    expect(result.path.slice(1, -1).every((p) => p.y === 3 || p.y === 7)).toBe(true);
  });
  it("refuses a detour that costs more than the available Move", () => {
    const cap = snapshot();
    cap.move = 7;
    expect(move({ capability: cap }).ok).toBe(false);
  });
  it("does not allow destinations inside cover, outside the arena or non-finite", () => {
    for (const to of [
      { x: 5, y: 5 },
      { x: -1, y: 0 },
      { x: NaN, y: 0 },
    ])
      expect(move({ to }).ok).toBe(false);
  });
  it("opens the direct route after destruction", () => {
    expect(move({ cover: { wall: 1000 } })).toMatchObject({
      ok: true,
      path: [
        { x: 2, y: 5 },
        { x: 8, y: 5 },
      ],
    });
  });
  it("supports explicitly walkable scenery", () => {
    expect(
      move({ arena: { ...arena, cover: [{ ...arena.cover![0]!, blocksMovement: false }] } }),
    ).toMatchObject({
      ok: true,
      path: [
        { x: 2, y: 5 },
        { x: 8, y: 5 },
      ],
    });
  });
  it("refuses a room-spanning barrier with no route", () => {
    const closed = {
      ...arena,
      cover: [{ ...arena.cover![0]!, rect: { x: 4, y: 0, width: 2, height: 20 } }],
    };
    // Boundaries are point-walkable, so test a destination fully enclosed by four overlapping walls.
    const box = {
      ...closed,
      cover: [
        { ...arena.cover![0]!, rect: { x: 4, y: 4, width: 6, height: 1 } },
        { ...arena.cover![0]!, rect: { x: 4, y: 9, width: 6, height: 1 } },
        { ...arena.cover![0]!, rect: { x: 4, y: 4, width: 1, height: 6 } },
        { ...arena.cover![0]!, rect: { x: 9, y: 4, width: 1, height: 6 } },
      ],
    };
    expect(walkingPath(box, {}, { x: 2, y: 7 }, { x: 7, y: 7 })).toBeNull();
  });
  it("uses live wounds and stats, never encounter-start MOVE", () => {
    const cap = snapshot();
    cap.move = 6;
    cap.woundState = "serious";
    expect(move({ capability: cap })).toMatchObject({ ok: false, code: "move_exceeded" });
  });
  it("refuses movement off-turn and after a Move, without spending the Action", () => {
    const cap = snapshot();
    cap.turn.isPlayerTurn = false;
    expect(move({ capability: cap })).toMatchObject({ ok: false, code: "not_your_turn" });
    cap.turn.isPlayerTurn = true;
    cap.turn.metresMoved = 2;
    expect(move({ capability: cap })).toMatchObject({ ok: false, code: "movement_spent" });
    expect(move()).toMatchObject({ ok: true, cost: { action: false } });
  });
});

describe("remaining combat choices", () => {
  it("keeps movement and the second ROF attack after shooting", () => {
    const cap = snapshot();
    Object.assign(cap.turn, spendCost(cap.turn, ATTACK_COST, pistol.itemId));
    expect(remainingCombatTurn(cap)).toEqual({
      movement: 8,
      action: false,
      attacks: 1,
      exhausted: false,
    });
    expect(previewAttack(cap, "h", pistol.itemId).gap).toBeNull();
    expect(
      judgeAction(cap, { kind: "skill_check", skillId: "persuasion", intent: "bluff" }),
    ).toMatchObject({ ok: false, code: "action_spent" });
  });
  it("only exhausts after both attacks and the Move are spent", () => {
    const cap = snapshot();
    Object.assign(cap.turn, spendCost(cap.turn, ATTACK_COST, pistol.itemId));
    Object.assign(cap.turn, spendCost(cap.turn, ATTACK_COST, pistol.itemId));
    expect(remainingCombatTurn(cap).exhausted).toBe(false);
    cap.turn.metresMoved = 3;
    expect(remainingCombatTurn(cap).exhausted).toBe(true);
  });
  it("cannot get extra attacks by alternating weapons", () => {
    const cap = snapshot();
    cap.weapons.push({ ...pistol, itemId: "medium_pistol" });
    Object.assign(cap.turn, spendCost(cap.turn, ATTACK_COST, pistol.itemId));
    expect(previewAttack(cap, "h", "medium_pistol").gap).toBeNull();
    Object.assign(cap.turn, spendCost(cap.turn, ATTACK_COST, "medium_pistol"));
    expect(previewAttack(cap, "h", pistol.itemId).verdict).toMatchObject({
      ok: false,
      code: "rof_exceeded",
    });
  });
  it("does not extend a ROF 1 attack by switching to a ROF 2 weapon", () => {
    const cap = snapshot();
    cap.weapons.push({ ...pistol, itemId: "very_heavy_pistol", rof: 1 });
    Object.assign(cap.turn, spendCost(cap.turn, ATTACK_COST, "very_heavy_pistol"));
    expect(previewAttack(cap, "h", pistol.itemId).gap).not.toBeNull();
  });
  it("keeps Move after reload or a check, but permits no further Action", () => {
    const cap = snapshot();
    Object.assign(cap.turn, spendCost(cap.turn, ONE_ACTION));
    expect(remainingCombatTurn(cap)).toMatchObject({
      movement: 8,
      action: false,
      attacks: 0,
      exhausted: false,
    });
    expect(previewAttack(cap, "h", pistol.itemId).gap).not.toBeNull();
    expect(
      judgeAction(cap, { kind: "opposed_check", skillId: "persuasion", intent: "bluff" }).ok,
    ).toBe(false);
  });
  it("uses remaining ammunition when deciding if another attack is available", () => {
    const cap = snapshot();
    cap.weapons = [{ ...pistol, roundsLoaded: 0 }];
    Object.assign(cap.turn, spendCost(cap.turn, ATTACK_COST, pistol.itemId));
    cap.turn.metresMoved = 4;
    expect(remainingCombatTurn(cap).exhausted).toBe(true);
  });
  it("previews the exact range band and refuses blocked shots", () => {
    const cap = snapshot();
    expect(previewAttack(cap, "h", pistol.itemId)).toMatchObject({
      distance: 12,
      dv: 15,
      gap: null,
    });
    cap.targets[0]!.distance = 13;
    expect(previewAttack(cap, "h", pistol.itemId).dv).toBe(20);
    cap.targets[0]!.perceivable = false;
    cap.targets[0]!.coverLabel = "a car";
    expect(previewAttack(cap, "h", pistol.itemId).gap).toContain("a car");
  });
});
