import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { streetPropFiles } from "../courtyard/streetPropArt";
import {
  FRAME,
  SEDAN,
  SEDAN_ART_PAD,
  STREET_PROP_PACK,
  STREET_PROP_PACK_2,
  KIOSK,
  propArtRegistration,
  sectionArtOnGuide,
  sectionFrameOnGuide,
  sedanCut,
  sedanPoint,
  toGuide,
  wreckVolume,
  WRECK_DEBRIS,
  PLANTER,
  CABINET,
  framePoint,
} from "../courtyard/streetPropPack";

type Point = { x: number; y: number };
const DIR = join(process.cwd(), "public/images/street-props");
const KINDS = ["sedan-engine", "sedan-cabin", "planter", "mailboxes", "shop-display"] as const;

/** Width, height and alpha flag of an extended (VP8X) WebP. */
function webpHeader(file: string) {
  const b = readFileSync(file);
  expect(b.toString("ascii", 0, 4)).toBe("RIFF");
  expect(b.toString("ascii", 8, 12)).toBe("WEBP");
  expect(b.toString("ascii", 12, 16), file).toBe("VP8X");
  const u24 = (o: number) => b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);
  return { width: u24(24) + 1, height: u24(27) + 1, alpha: (b[20]! & 0x10) !== 0 };
}

function inside(poly: readonly Point[], p: Point) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      hit = !hit;
  }
  return hit;
}

describe("street prop art: the files the board loads", () => {
  it("replaces each procedural texture under its own key, never mirrored", () => {
    const files = streetPropFiles(KINDS);
    const map = Object.fromEntries(files.map((f) => [f.url.split("/").pop(), f.textures]));
    // the sedan has its own art per rotation
    expect(map["sedan-engine-intact.webp"]).toEqual(["prop-sedan-engine-intact"]);
    expect(map["sedan-engine-intact-90.webp"]).toEqual(["prop-sedan-engine-intact-90"]);
    expect(map["sedan-cabin-wrecked-90.webp"]).toEqual(["prop-sedan-cabin-wrecked-90"]);
    // the square, symmetric planter serves both rotations from one file
    expect(map["planter-damaged.webp"]).toEqual([
      "prop-planter-damaged",
      "prop-planter-damaged-90",
    ]);
    // the cabinet and the merchandise stand have their own art per rotation (round two)
    expect(map["mailboxes-wrecked.webp"]).toEqual(["prop-mailboxes-wrecked"]);
    expect(map["mailboxes-intact-90.webp"]).toEqual(["prop-mailboxes-intact-90"]);
    expect(map["shop-display-damaged.webp"]).toEqual(["prop-shop-display-damaged"]);
    expect(map["shop-display-wrecked-90.webp"]).toEqual(["prop-shop-display-wrecked-90"]);
    // the sedan's other paints (`sedanPaint.ts`): intact and damaged, each rotation;
    // a wreck is burned to bare metal and keeps the one picture
    expect(map["sedan-cabin-damaged-90-burgundy.webp"]).toEqual([
      "prop-sedan-cabin-damaged-90~burgundy",
    ]);
    expect(map["sedan-engine-intact-charcoal.webp"]).toEqual(["prop-sedan-engine-intact~charcoal"]);
    expect(
      Object.keys(map).filter((n) => n.includes("wrecked-") && /burgundy|charcoal/.test(n)),
    ).toEqual([]);
    expect(files).toHaveLength(12 + 3 + 6 + 6 + 2 * 2 * 2 * 2);
    expect(new Set(files.map((f) => f.key)).size).toBe(files.length);
  });

  it("loads nothing for a kind without art", () => {
    expect(streetPropFiles(["crates", "barrier"] as never)).toEqual([]);
  });

  it("ships every file it names, at twice the procedural frame plus its padding, with alpha", () => {
    const files = streetPropFiles(KINDS);
    const names = files.map((f) => f.url.split("/").pop()!);
    expect(readdirSync(DIR).sort()).toEqual([...names].sort());
    for (const file of files) {
      const name = file.url.split("/").pop()!;
      const sedan = file.kind.startsWith("sedan-");
      expect(webpHeader(join(DIR, name)), name).toEqual({
        width: 2 * (FRAME.width + (sedan ? 2 * SEDAN_ART_PAD.side : 0)),
        height: 2 * (FRAME.height + (sedan ? SEDAN_ART_PAD.top : 0)),
        alpha: true,
      });
    }
  });

  it("registers padded art by its 2 m frame, so the footprint never moves", () => {
    // unpadded art is the procedural registration exactly
    expect(propArtRegistration("planter")).toEqual({ originX: 0.5, originY: 1, groundWidth: 1 });
    const r = propArtRegistration("sedan-cabin");
    const width = FRAME.width + 2 * SEDAN_ART_PAD.side;
    // the frame's front corner (its bottom centre) is still the origin
    expect(r.originX * width).toBe(SEDAN_ART_PAD.side + FRAME.width / 2);
    expect(r.originY).toBe(1);
    // and the frame, not the padded art, spans the footprint's projected width
    expect(r.groundWidth * width).toBe(FRAME.width);
  });
});

describe("street prop art: the sedan's cut", () => {
  const roof = (g: (typeof STREET_PROP_PACK)[number]) =>
    toGuide(
      g,
      sedanPoint(
        (SEDAN.cabin.x0 + SEDAN.cabin.x1) / 2,
        (SEDAN.cabin.y0 + SEDAN.cabin.y1) / 2,
        SEDAN.roof,
        g.rotation,
      ),
    );

  /** What the nearer section keeps: inside its shape and outside its hole. */
  const keeps = (cut: ReturnType<typeof sedanCut>, p: Point) =>
    inside(cut.nearerShape, p) && !(cut.nearerHole && inside(cut.nearerHole, p));

  it("gives the whole glasshouse to the cabin, so no half carries a roof stub", () => {
    const g = STREET_PROP_PACK.find((p) => p.id === "sedan-r90")!;
    const cut = sedanCut(g);
    expect(cut.nearer).toBe("sedan-engine");
    // the engine (nearer here) keeps no roof and no windscreen, top or foot, though
    // its 2 m box overlaps the windscreen's foot on screen
    expect(keeps(cut, roof(g))).toBe(false);
    for (const z of [SEDAN.roof, (SEDAN.hood + SEDAN.roof) / 2, SEDAN.hood + 0.1]) {
      const x = SEDAN.windscreenFoot + ((z - SEDAN.hood) / (SEDAN.roof - SEDAN.hood)) * 0.6;
      for (const y of [0.5, 1, 1.5])
        expect(keeps(cut, toGuide(g, sedanPoint(x, y, z, g.rotation))), `${x},${y},${z}`).toBe(
          false,
        );
    }
    // but it keeps its bonnet
    const bonnet = toGuide(g, sedanPoint(1, 1, SEDAN.hood, g.rotation));
    expect(keeps(cut, bonnet)).toBe(true);
  });

  it("gives the cabin its aerial, which stands off the rear wing", () => {
    const g = STREET_PROP_PACK.find((p) => p.id === "sedan-r0")!;
    const cut = sedanCut(g);
    expect(cut.nearer).toBe("sedan-cabin");
    for (const y of [SEDAN.body.y0, SEDAN.body.y1])
      expect(keeps(cut, toGuide(g, sedanPoint(3.5, y, SEDAN.roof + 0.5, 0)))).toBe(true);
  });

  it("never asks the nearer section to keep what lies outside its own art", () => {
    for (const g of STREET_PROP_PACK.filter((p) => p.id.startsWith("sedan"))) {
      const cut = sedanCut(g);
      const f = sectionArtOnGuide(
        g,
        g.sections.findIndex((s) => s.art === cut.nearer),
      );
      for (const p of cut.nearerShape) {
        expect(p.x).toBeGreaterThanOrEqual(f.x - 1e-6);
        expect(p.x).toBeLessThanOrEqual(f.x + f.width + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(f.y - 1e-6);
        expect(p.y).toBeLessThanOrEqual(f.y + f.height + 1e-6);
      }
      if (g.rotation === 0) expect(keeps(cut, roof(g))).toBe(true);
      // the art is the frame padded, never smaller
      const frame = sectionFrameOnGuide(g, 0);
      expect(f.width).toBeGreaterThan(frame.width);
    }
  });
});

describe("street prop art: the wreck volume", () => {
  it("caps each wreck at its state's limit, over its own ground and no further", () => {
    for (const g of [...STREET_PROP_PACK, ...STREET_PROP_PACK_2]) {
      const [body, ...debris] = wreckVolume(g);
      const sedan = g.id.startsWith("sedan");
      const cabinet = g.id.startsWith("cabinet");
      const max = sedan
        ? SEDAN.wreckedMax
        : g.id === "planter"
          ? PLANTER.wreckedMax
          : g.id.startsWith("kiosk")
            ? KIOSK.wreckedMax
            : CABINET.wreckedMax;
      const at = (x: number, y: number, z: number) =>
        toGuide(g, sedan ? sedanPoint(x, y, z, g.rotation) : framePoint(x, y, z, g.rotation));
      // the body's ceiling is the limit: a point just under it is in, just over it is out
      const mid = sedan ? { x: 2, y: 1 } : { x: 1, y: cabinet ? 0.85 : 1 };
      expect(inside(body!.hull, at(mid.x, mid.y, max - 0.05))).toBe(true);
      const far = sedan ? { x: 0.2, y: 1.85 } : { x: 0.15, y: cabinet ? 1.28 : 1.85 };
      expect(inside(body!.hull, at(far.x, far.y, max + 0.15))).toBe(false);
      // debris lies on the prop's own 2 m ground, as thin as `WRECK_DEBRIS`
      expect(debris.length).toBe(sedan ? 2 : 1);
      expect(inside(debris[0]!.hull, at(1, 1, WRECK_DEBRIS - 0.02))).toBe(true);
      expect(inside(debris[0]!.hull, at(-0.2, 1, 0))).toBe(false);
    }
  });
});
