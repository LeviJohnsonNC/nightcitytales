import { expect, it } from "vitest";
import { composeScene, readBattlefieldSnapshot, attachmentPoint, rectsOverlap } from "../index";

it("preserves facade ownership and clear walking space through save/read across variants", () => {
  for (let seed = 0; seed < 32; seed++) {
    const scene = composeScene("intersection", seed).layout;
    const loaded = readBattlefieldSnapshot(JSON.parse(JSON.stringify(scene)));
    expect(loaded).toEqual(scene);
    const env = loaded.arena.environment!;
    expect(env.structures.flatMap((s) => s.attachments ?? [])).toHaveLength(seed === 8 ? 5 : 4);
    const shop = env.structures.find((s) => s.id === "building_0")!;
    const canopy = shop.attachments![0]!;
    const p = attachmentPoint(shop, canopy, 0),
      q = attachmentPoint(shop, canopy, canopy.span, canopy.projection);
    const footprint = {
      x: Math.min(p.x, q.x),
      y: Math.min(p.y, q.y),
      width: Math.abs(p.x - q.x),
      height: Math.abs(p.y - q.y),
    };
    const through = env.zones.find((z) => z.id === "walk-west-north")!;
    expect(rectsOverlap(footprint, through.rect)).toBe(false);
    expect(canopy.height).toBeGreaterThan(2);
    const entrance = env.entrances!.find((e) => e.structureId === shop.id)!;
    expect(entrance.position.x).toBeGreaterThanOrEqual(footprint.x);
    expect(entrance.position.x).toBeLessThanOrEqual(footprint.x + footprint.width);
    expect(entrance.position.y).toBeGreaterThanOrEqual(footprint.y);
    expect(entrance.position.y).toBeLessThanOrEqual(footprint.y + footprint.height);
  }
});
it("transposes facade edges and coordinates together", () => {
  const base = {
    id: "test",
    label: "test",
    rect: { x: 2, y: 4, width: 8, height: 6 },
    height: 4,
    style: "shop" as const,
    blocksMovement: true,
    blocksShots: true,
  };
  for (const edge of ["north", "east", "south", "west"] as const) {
    const a = {
      id: "a",
      kind: "awning" as const,
      edge,
      offset: 1,
      span: 2,
      projection: 1,
      height: 2.5,
    };
    const p = attachmentPoint(base, a, 2, 1);
    const rotated = { ...base, rect: { x: 4, y: 2, width: 6, height: 8 } };
    const swapped = { north: "west", east: "south", south: "east", west: "north" } as const;
    expect(attachmentPoint(rotated, { ...a, edge: swapped[edge] }, 2, 1)).toEqual({
      x: p.y,
      y: p.x,
    });
  }
});
it("rejects malformed saved attachments and retains legacy layouts without them", () => {
  const saved = composeScene("intersection", 1).layout;
  for (const change of [
    { span: 99 },
    { offset: -1 },
    { height: 0 },
    { projection: 3 },
    { edge: "roof" },
    { kind: "solid-wall" },
  ]) {
    const bad = structuredClone(saved);
    Object.assign(
      bad.arena.environment!.structures.find((s) => s.id === "building_0")!.attachments![0]!,
      change,
    );
    expect(() => readBattlefieldSnapshot(bad)).toThrow();
  }
  for (const s of saved.arena.environment!.structures) delete s.attachments;
  expect(readBattlefieldSnapshot(saved)).toEqual(saved);
});
it("does not attach facade decorations to accepted interiors", () => {
  for (const kind of ["office", "nightclub"] as const)
    for (let seed = 0; seed < 3; seed++)
      expect(
        composeScene(kind, seed).layout.arena.environment!.structures.every(
          (s) => s.attachments === undefined,
        ),
      ).toBe(true);
});
