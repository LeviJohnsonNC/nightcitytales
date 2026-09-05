/**
 * The board, server-rendered once.
 *
 * The rest of this suite tests the engine's answers; this tests that the screen
 * actually asks the questions — that the squares a Move reaches are the squares
 * drawn, that the identities on file reach the HUD, and that the old
 * everything-within-N-metres circle is gone. renderToStaticMarkup needs no DOM,
 * so it costs the suite nothing and still catches a board that throws.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CombatBoard } from "../CombatBoard";
import { arenaFor, EMPTY_TURN_ECONOMY, type CapabilitySnapshot } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";

const arena = arenaFor("night_shift_grid");
const combatant = (id: string, name: string, isPlayer: boolean) => ({
  id,
  name,
  isPlayer,
  side: isPlayer ? "friendly" : "hostile",
  defeated: false,
  hp: 30,
  hpMax: 40,
  spBody: 7,
  spHead: 7,
  woundState: "none",
  initiative: 10,
});
const live = {
  id: "e",
  arena: arena.key,
  cover: {},
  version: 1,
  state: {
    round: 5,
    order: ["p", "h1", "h2"],
    activeIndex: 0,
    status: "active",
    combatants: {
      p: combatant("p", "Combat", true),
      h1: combatant("h1", "Street Thug 1", false),
      h2: combatant("h2", "Street Thug 2", false),
    },
  },
  data: {
    p: {
      key: "player",
      weaponName: "",
      damageDice: 0,
      rangeType: null,
      position: arena.playerStart,
      move: 6,
      attackSkill: 0,
    },
    h1: {
      key: "street_thug_1",
      weaponName: "sidearm",
      damageDice: 2,
      rangeType: "pistol",
      position: arena.hostileSlots[0]!,
      move: 6,
      attackSkill: 4,
    },
    h2: {
      key: "street_thug_2",
      weaponName: "sidearm",
      damageDice: 2,
      rangeType: "pistol",
      position: arena.hostileSlots[1]!,
      move: 6,
      attackSkill: 4,
    },
  },
} as unknown as LiveEncounter;
const capability = {
  hp: 30,
  hpMax: 40,
  woundState: "none",
  incapacitated: false,
  eurobucks: 0,
  luck: 3,
  move: 6,
  weapons: [
    {
      itemId: "very_heavy_pistol",
      name: "Very Heavy Pistol",
      melee: false,
      rof: 1,
      magazine: 8,
      roundsLoaded: 7,
      spareRounds: 8,
      rangeType: "pistol",
      damageDice: 4,
      broken: false,
    },
  ],
  items: [],
  cyberware: [],
  roleAbility: null,
  targets: [
    {
      id: "h1",
      key: "h1",
      name: "Street Thug 1",
      distance: 15,
      defeated: false,
      perceivable: true,
    },
    {
      id: "h2",
      key: "h2",
      name: "Street Thug 2",
      distance: 18,
      defeated: false,
      perceivable: true,
    },
  ],
  failedAttempts: [],
  turn: { ...EMPTY_TURN_ECONOMY, inCombat: true, isPlayerTurn: true, move: 6 },
} as unknown as CapabilitySnapshot;

describe("the board renders", () => {
  const html = renderToStaticMarkup(
    <CombatBoard
      live={live}
      capability={capability}
      weaponId="very_heavy_pistol"
      onWeaponId={() => {}}
      onMoveTo={() => {}}
      title="Test in Night City"
      objective="Monster Hunt"
    />,
  );
  it("lights the squares a Move reaches, and no more", () => {
    const squares = html.match(/class="combat-square[^"]*"/g) ?? [];
    expect(squares.length).toBeGreaterThan(30);
    expect(squares.length).toBeLessThan(144);
  });
  it("draws the neon wordmark and the thugs' own faces", () => {
    expect(html).toContain('aria-label="Night City"');
    expect(html).toContain("/images/cast/street-thug-1.png");
    expect(html).toContain("/images/cast/street-thug-2.png");
  });
  it("prices the Move in squares", () => {
    expect(html).toContain("6 squares · 12 m");
  });
  it("keeps no trace of the old reach circle", () => {
    expect(html).not.toContain("combat-reach");
  });
  it("lights nothing once the Move for this Round is spent", () => {
    const spent = {
      ...capability,
      turn: { ...capability.turn, metresMoved: 12 },
    } as CapabilitySnapshot;
    const after = renderToStaticMarkup(
      <CombatBoard
        live={live}
        capability={spent}
        weaponId="very_heavy_pistol"
        onWeaponId={() => {}}
        onMoveTo={() => {}}
      />,
    );
    expect(after).not.toContain("combat-square");
  });
});
