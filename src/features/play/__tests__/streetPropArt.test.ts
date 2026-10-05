import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { streetPropFiles } from "../courtyard/streetPropArt";
import {
  SEDAN,
  STREET_PROP_PACK,
  sectionFrameOnGuide,
  sedanCut,
  sedanPoint,
  toGuide,
} from "../courtyard/streetPropPack";

type Point = { x: number; y: number };
const DIR = join(process.cwd(), "public/images/street-props");

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
    const files = streetPropFiles(["sedan-engine", "sedan-cabin", "planter", "mailboxes"]);
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
    // the cabinet has art at rotation 0 only; rotated, it keeps the procedural kit
    expect(map["mailboxes-wrecked.webp"]).toEqual(["prop-mailboxes-wrecked"]);
    expect(files.flatMap((f) => f.textures)).not.toContain("prop-mailboxes-intact-90");
    expect(files).toHaveLength(12 + 3 + 3);
    expect(new Set(files.map((f) => f.key)).size).toBe(files.length);
  });

  it("loads nothing for a kind without art", () => {
    expect(streetPropFiles(["crates", "barrier"] as never)).toEqual([]);
  });

  it("ships every file it names, at twice the procedural frame, with alpha", () => {
    const files = streetPropFiles(["sedan-engine", "sedan-cabin", "planter", "mailboxes"]);
    const names = files.map((f) => f.url.split("/").pop()!);
    expect(readdirSync(DIR).sort()).toEqual([...names].sort());
    for (const name of names)
      expect(webpHeader(join(DIR, name)), name).toEqual({ width: 512, height: 640, alpha: true });
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

  it("gives the whole glasshouse to the cabin, so no half carries a roof stub", () => {
    const g = STREET_PROP_PACK.find((p) => p.id === "sedan-r90")!;
    const cut = sedanCut(g);
    expect(cut.nearer).toBe("sedan-engine");
    // the engine (nearer here) keeps no roof and no windscreen top
    expect(inside(cut.nearerShape, roof(g))).toBe(false);
    const screenTop = toGuide(g, sedanPoint(SEDAN.cabin.x0, 1, SEDAN.roof, g.rotation));
    expect(inside(cut.nearerShape, screenTop)).toBe(false);
    // but it keeps its bonnet
    const bonnet = toGuide(g, sedanPoint(1, 1, SEDAN.hood, g.rotation));
    expect(inside(cut.nearerShape, bonnet)).toBe(true);
  });

  it("never asks the nearer section to keep what lies outside its own frame", () => {
    for (const g of STREET_PROP_PACK.filter((p) => p.id.startsWith("sedan"))) {
      const cut = sedanCut(g);
      const f = sectionFrameOnGuide(
        g,
        g.sections.findIndex((s) => s.art === cut.nearer),
      );
      for (const p of cut.nearerShape) {
        expect(p.x).toBeGreaterThanOrEqual(f.x - 1e-6);
        expect(p.x).toBeLessThanOrEqual(f.x + f.width + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(f.y - 1e-6);
        expect(p.y).toBeLessThanOrEqual(f.y + f.height + 1e-6);
      }
      if (g.rotation === 0) expect(inside(cut.nearerShape, roof(g))).toBe(true);
    }
  });
});
