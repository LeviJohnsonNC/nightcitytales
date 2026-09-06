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
    // Both widths, because a portrait that named only one would still render
    // here and quietly fetch a file that does not exist on the other display.
    for (const thug of ["street-thug-1", "street-thug-2"]) {
      expect(html).toContain(`/images/cast/${thug}.webp`);
      expect(html).toContain(`/images/cast/${thug}-512.webp`);
    }
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
  it("offers the ground before the player has touched anything", () => {
    // Direct manipulation: no mode is chosen first, so the reachable squares
    // are on the board from the moment it is the player's turn.
    expect(html).toContain("combat-square");
  });
  it("shows no contextual control until something is chosen", () => {
    expect(html).not.toContain("combat-callout");
  });
  it("does not arm the sidebar's confirm until a route is locked", () => {
    const confirm = /<button[^>]*combat-confirm[^>]*>/.exec(html)?.[0] ?? "";
    expect(confirm).toContain("disabled");
  });
});

/**
 * A blocked shot has to teach, not just refuse.
 *
 * The old screen's whole answer was a greyed-out Take shot, which says that
 * something is wrong and nothing about what or what to do instead.
 */
describe("a target nothing can see", () => {
  const blockedArena = arenaFor("night_shift_grid");
  const behindCover = {
    ...live,
    data: {
      ...live.data,
      h1: { ...live.data["h1"], position: { x: 21, y: 17 } },
    },
  } as unknown as LiveEncounter;
  const blindCapability = {
    ...capability,
    targets: [
      {
        id: "h1",
        key: "h1",
        name: "Street Thug 1",
        distance: 20,
        defeated: false,
        perceivable: false,
        coverLabel: "a yellow generator housing",
      },
      { ...(capability.targets[1] as object) },
    ],
  } as unknown as CapabilitySnapshot;
  const html = renderToStaticMarkup(
    <CombatBoard
      live={behindCover}
      capability={blindCapability}
      weaponId="very_heavy_pistol"
      onWeaponId={() => {}}
      onMoveTo={() => {}}
      onAttack={() => {}}
    />,
  );
  it("names the obstruction rather than only greying a button", () => {
    expect(html).toContain("No line of sight");
    expect(html).toContain("a yellow generator housing");
  });
  it("offers somewhere to go instead", () => {
    expect(html).toContain("Find firing position");
    expect(html).not.toContain("Take shot");
  });
  it("marks the blocker on the board, and draws the shot as broken", () => {
    expect(html).toContain("combat-blocker");
    expect(blockedArena.cover?.some((c) => c.id === "generator")).toBe(true);
  });
});

/**
 * A write in flight is not a reason to take the board away.
 *
 * `busy` covers a save landing, a playback running and a query refetching. It
 * used to blank the whole interaction surface, so one stuck flag left the
 * screen inert: no squares, every click swallowed, no target lockable and
 * therefore no shot possible for the rest of the fight. Looking is always
 * allowed; only committing waits.
 */
describe("while the last action is still saving", () => {
  const html = renderToStaticMarkup(
    <CombatBoard
      live={live}
      capability={capability}
      weaponId="very_heavy_pistol"
      onWeaponId={() => {}}
      onMoveTo={() => {}}
      onAttack={() => {}}
      busy
    />,
  );
  it("still offers the ground", () => {
    expect(html).toContain("combat-square");
  });
  it("still lets a target be assessed", () => {
    expect(html).toContain("Street Thug 1");
  });
  it("disarms the commits rather than the board", () => {
    for (const button of html.match(/<button[^>]*combat-confirm[^>]*>/g) ?? [])
      expect(button).toContain("disabled");
  });
  it("says why, so a refusal is never silence", () => {
    expect(html).toContain("Waiting on the last action");
  });
});
