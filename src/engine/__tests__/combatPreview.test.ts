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
// 10x10 squares. The wall fills one column of three, so the only way past it
// is round an end — the point of the fixture, on the lattice.
const arena: Arena = {
  key: "test",
  label: "test",
  extent: { width: 20, height: 20 },
  playerStart: { x: 3, y: 5 },
  hostileSlots: [],
  cover: [
    {
      id: "wall",
      label: "wall",
      material: "concrete",
      thickness: "thick",
      rect: { x: 4, y: 2, width: 2, height: 6 },
    },
  ],
};
/** Squares 1 and 4 of row 2, with the wall's column 2 between them. */
const START = { x: 3, y: 5 };
const FINISH = { x: 9, y: 5 };
const move = (patch: Partial<Parameters<typeof previewMovement>[0]> = {}) =>
  previewMovement({
    arena,
    cover: {},
    from: START,
    to: FINISH,
    capability: snapshot(),
    ...patch,
  });

describe("movement previews on the battlemat grid", () => {
  it("stands on square centres and routes around solid cover", () => {
    const result = move();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path[0]).toEqual(START);
    expect(result.position).toEqual(FINISH);
    // Every step is a square centre: odd metres, on a 2 m lattice.
    for (const p of result.path) {
      expect(p.x % 2).toBe(1);
      expect(p.y % 2).toBe(1);
    }
    // Nobody walks through the wall, and the detour costs more than the 6 m
    // straight line it replaces.
    expect(result.path.some((p) => p.x === 5 && p.y >= 3 && p.y <= 7)).toBe(false);
    expect(result.moved).toBeGreaterThan(6);
    expect(result.cost.metres).toBe(result.moved);
  });
  it("prices a diagonal step above an orthogonal one", () => {
    // Four squares of open ground: straight is 4 squares, the dogleg is 3.5.
    const open = { ...arena, cover: [] };
    const straight = move({ arena: open, to: { x: 11, y: 5 } });
    const diagonal = move({ arena: open, to: { x: 11, y: 7 } });
    expect(straight.ok && diagonal.ok).toBe(true);
    if (!straight.ok || !diagonal.ok) return;
    expect(diagonal.moved).toBeGreaterThan(straight.moved);
  });
  it("refuses a detour that costs more squares than the Move covers", () => {
    const cap = snapshot();
    cap.move = 5;
    expect(move({ capability: cap }).ok).toBe(false);
  });
  it("does not allow destinations inside cover, outside the arena or non-finite", () => {
    for (const to of [
      { x: 5, y: 5 },
      { x: -1, y: 0 },
      { x: 40, y: 5 },
      { x: NaN, y: 0 },
    ])
      expect(move({ to }).ok).toBe(false);
  });
  it("will not slip diagonally through the corner where two crates touch", () => {
    const pinch = {
      ...arena,
      cover: [
        { ...arena.cover![0]!, id: "a", rect: { x: 4, y: 4, width: 2, height: 2 } },
        { ...arena.cover![0]!, id: "b", rect: { x: 6, y: 6, width: 2, height: 2 } },
      ],
    };
    const through = move({ arena: pinch, from: { x: 3, y: 7 }, to: { x: 7, y: 5 } });
    expect(through.ok).toBe(true);
    if (!through.ok) return;
    // The route exists, but it goes the long way rather than between the corners.
    expect(through.path).not.toContainEqual({ x: 5, y: 7 });
  });
  it("opens the direct route after destruction", () => {
    expect(move({ cover: { wall: 1000 } })).toMatchObject({
      ok: true,
      moved: 6,
      path: [START, { x: 5, y: 5 }, { x: 7, y: 5 }, FINISH],
    });
  });
  it("supports explicitly walkable scenery", () => {
    expect(
      move({ arena: { ...arena, cover: [{ ...arena.cover![0]!, blocksMovement: false }] } }),
    ).toMatchObject({ ok: true, path: [START, { x: 5, y: 5 }, { x: 7, y: 5 }, FINISH] });
  });
  it("uses live wounds and stats, never encounter-start MOVE", () => {
    const cap = snapshot();
    cap.move = 7;
    cap.woundState = "mortal"; // -6 MOVE, floored at 1 square
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
      movement: 16,
      movementSquares: 8,
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
      movement: 16,
      movementSquares: 8,
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
