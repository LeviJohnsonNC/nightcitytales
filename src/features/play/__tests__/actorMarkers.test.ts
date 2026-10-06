import { describe, expect, it } from "vitest";
import {
  MARKER,
  layoutMarkers,
  markerFor,
  markerRole,
  markerSize,
  type MarkerActor,
  type MarkerAttention,
} from "../actorMarkers";
import { OVERLAY, boardOutline, overlayMode, squaresOutline } from "../overlayModel";
import type { SceneStructure } from "@/engine";

const person = (over: Partial<MarkerActor>): MarkerActor => ({
  id: "a",
  name: "6th Street rifleman",
  side: "hostile",
  isPlayer: false,
  hp: 40,
  hpMax: 40,
  defeated: false,
  ...over,
});
const none: MarkerAttention = { locked: null, pointed: null, hovered: null, focused: null };

describe("what each person's marker says", () => {
  it("ranks the locked target over anyone pointed at, and those over everyone else", () => {
    const a = person({ id: "a" });
    expect(markerRole(a, { ...none, locked: "a", hovered: "a" })).toBe("target");
    expect(markerRole(a, { ...none, hovered: "a" })).toBe("pointed");
    expect(markerRole(a, { ...none, focused: "a" })).toBe("pointed");
    expect(markerRole(a, { ...none, pointed: "a" })).toBe("pointed");
    expect(markerRole(a, none)).toBe("threat");
    expect(markerRole(person({ side: "friendly" }), none)).toBe("ally");
    expect(markerRole(person({ side: "neutral" }), none)).toBe("bystander");
    expect(markerRole(person({ isPlayer: true, side: "friendly" }), none)).toBe("self");
    expect(markerRole(person({ defeated: true }), { ...none, locked: "a" })).toBe("out");
  });

  it("gives the target and anyone pointed at their full name and HP", () => {
    for (const attention of [
      { ...none, locked: "a" },
      { ...none, hovered: "a" },
      { ...none, focused: "a" },
    ]) {
      const m = markerFor(person({ hp: 12 }), attention, "");
      expect(m.detail).toBe(true);
      expect(m.name).toBe("6th Street rifleman");
      expect(m.hp).toBe("12/40");
      expect(m.bar).toEqual({ width: MARKER.barDetail, fraction: 0.3 });
    }
  });

  it("keeps an uninvolved threat to a shape and a slim bar, without a name", () => {
    const m = markerFor(person({}), none, "");
    expect(m).toMatchObject({ glyph: "diamond", name: null, hp: null, hidden: false });
    expect(m.bar?.width).toBe(MARKER.barCompact);
  });

  it("marks the player with a caret instead of a word, and names them only on demand", () => {
    const you = person({ id: "me", isPlayer: true, side: "friendly", name: "Vex" });
    expect(markerFor(you, none, "")).toMatchObject({ glyph: "caret", name: null });
    expect(markerFor(you, { ...none, hovered: "me" }, "")).toMatchObject({
      name: "Vex",
      hp: "40/40",
    });
  });

  it("puts nothing over a bystander at rest, and a bar once they are hurt", () => {
    expect(markerFor(person({ side: "neutral" }), none, "").hidden).toBe(true);
    const hurt = markerFor(person({ side: "neutral", hp: 20 }), none, "");
    expect(hurt.hidden).toBe(false);
    expect(hurt.glyph).toBe("ring");
    expect(hurt.bar?.fraction).toBe(0.5);
  });

  it("never hides what became of someone out of the fight", () => {
    const m = markerFor(person({ defeated: true }), none, "Down");
    expect(m).toMatchObject({ role: "out", glyph: "cross", status: "Down", hidden: false });
  });

  it("tells factions apart by shape, not colour alone", () => {
    const glyphs = new Set(
      [
        person({ isPlayer: true, side: "friendly" }),
        person({}),
        person({ side: "friendly" }),
        person({ side: "neutral", hp: 1 }),
        person({ defeated: true }),
      ].map((a) => markerFor(a, none, "Down").glyph),
    );
    expect(glyphs.size).toBe(5);
  });
});

describe("where the markers go", () => {
  const view = { width: 1200, height: 800 };
  const at = (
    id: string,
    x: number,
    y: number,
    attention = none,
    over: Partial<MarkerActor> = {},
  ) => ({
    id,
    marker: markerFor(person({ id, ...over }), attention, ""),
    x,
    y,
  });

  it("keeps a worded marker on screen and clear of the controls", () => {
    const placed = layoutMarkers([at("a", 4, 30, { ...none, locked: "a" })], view);
    const p = placed.get("a")!;
    const { width, height } = markerSize(markerFor(person({}), { ...none, locked: "a" }, ""));
    expect(p.x - width / 2).toBeGreaterThanOrEqual(MARKER.margin.side);
    expect(p.y - height).toBeGreaterThanOrEqual(MARKER.margin.top);
  });

  it("moves a later worded marker up rather than printing across an earlier one", () => {
    const placed = layoutMarkers(
      [
        at("a", 600, 400, { ...none, locked: "a", hovered: "b" }),
        at("b", 610, 405, { ...none, locked: "a", hovered: "b" }),
      ],
      view,
    );
    const a = placed.get("a")!;
    const b = placed.get("b")!;
    // the target keeps its place; the hovered one is stacked above it
    expect(a.dy).toBe(0);
    const ha = markerSize(markerFor(person({ id: "a" }), { ...none, locked: "a" }, "")).height;
    expect(b.y).toBeLessThanOrEqual(a.y - ha);
  });

  it("moves any marker off a fixed label such as IN THE WAY", () => {
    const placed = layoutMarkers([at("a", 600, 400)], view, [
      { left: 560, right: 640, top: 380, bottom: 410 },
    ]);
    expect(placed.get("a")!.y).toBeLessThanOrEqual(378);
  });

  it("draws nothing for a person off screen, or a bystander at rest", () => {
    const placed = layoutMarkers(
      [{ ...at("a", -400, 300), inView: false }, at("b", 300, 300, none, { side: "neutral" })],
      view,
    );
    expect(placed.size).toBe(0);
  });
});

describe("the movement overlay at rest and at work", () => {
  it("follows what the player is doing", () => {
    expect(overlayMode("idle")).toBe("rest");
    expect(overlayMode("move-hover")).toBe("plan");
    expect(overlayMode("move-preview")).toBe("plan");
    expect(overlayMode("find-firing-position")).toBe("aim");
    expect(overlayMode("target-selected")).toBe("target");
    expect(overlayMode("resolving-action")).toBe("rest");
  });

  it("draws no square lines at rest, and is quietest while a target is the point", () => {
    expect(OVERLAY.rest.square).toBe(0);
    expect(OVERLAY.rest.fill).toBeLessThan(OVERLAY.plan.fill);
    expect(OVERLAY.target.fill).toBe(0);
    expect(OVERLAY.target.edge).toBeLessThan(OVERLAY.rest.edge);
  });

  it("outlines the edge of reach: every side whose neighbour is out of reach", () => {
    // a 2 x 2 block of squares has 8 outer sides and no inner ones
    const block = [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ];
    expect(squaresOutline(block)).toHaveLength(8);
    // one square alone is four sides
    expect(squaresOutline([{ col: 3, row: 3 }])).toHaveLength(4);
  });
});

describe("the board's edge over a street", () => {
  const building = (over: Partial<SceneStructure> = {}) =>
    ({
      id: "b",
      style: "shop",
      height: 6,
      rect: { x: 20, y: 28, width: 10, height: 10 },
      ...over,
    }) as SceneStructure;
  const length = (runs: ReturnType<typeof boardOutline>) =>
    runs.reduce((sum, [a, b]) => sum + Math.hypot(b.x - a.x, b.y - a.y), 0);

  it("is the whole perimeter on open ground", () => {
    expect(length(boardOutline({ width: 32, height: 32 }, []))).toBeCloseTo(128, 0);
  });

  it("is never printed inside a building, nor behind one, unless it is cut away", () => {
    const runs = boardOutline({ width: 32, height: 32 }, [building()]);
    const inside = (p: { x: number; y: number }) => p.x > 20 && p.x < 30 && p.y > 28 && p.y < 38;
    for (const [a, b] of runs) {
      expect(inside({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })).toBe(false);
    }
    const full = length(runs);
    expect(full).toBeLessThan(128 - 9);
    // cut away for the reveal, the building hides only its own footprint
    const cut = length(boardOutline({ width: 32, height: 32 }, [building()], new Set(["b"])));
    expect(cut).toBeGreaterThanOrEqual(full);
    expect(cut).toBeLessThan(128 - 9);
  });

  it("is not interrupted by a fence", () => {
    const fence = building({ style: "mesh-fence" });
    expect(length(boardOutline({ width: 32, height: 32 }, [fence]))).toBeCloseTo(128, 0);
  });
});
