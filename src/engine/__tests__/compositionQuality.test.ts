import { describe, expect, it } from "vitest";
import { composeScene, readBattlefieldSnapshot, rectInside } from "../index";

describe("lived-in scene composition", () => {
  it.each(["office", "nightclub"] as const)(
    "furnishes %s without consuming circulation",
    (kind) => {
      for (let seed = 1; seed <= 3; seed++) {
        const { arena } = composeScene(kind, seed).layout;
        const env = arena.environment!;
        expect(arena.cover!.length).toBeGreaterThanOrEqual(kind === "office" ? 35 : 28);
        expect(new Set(env.props.map((p) => p.art)).size).toBeGreaterThanOrEqual(6);
        expect(env.structures.every((s) => Math.min(s.rect.width, s.rect.height) === 0.5)).toBe(
          true,
        );
        expect(
          readBattlefieldSnapshot(JSON.parse(JSON.stringify(composeScene(kind, seed).layout))),
        ).toEqual(composeScene(kind, seed).layout);
      }
    },
  );

  it("rejects a missing thin-wall connector even when tile centres remain blocked", () => {
    const snapshot = composeScene("office", 1).layout;
    const env = snapshot.arena.environment!;
    const connector = env.structures.findIndex(
      (s) => s.rect.width === 0.5 && s.rect.height === 1.5,
    );
    expect(connector).toBeGreaterThanOrEqual(0);
    env.structures.splice(connector, 1);
    expect(() => readBattlefieldSnapshot(snapshot)).toThrow();
  });

  it("still loads full-width version-three walls without regenerating them", () => {
    const snapshot = composeScene("office", 1).layout;
    const env = snapshot.arena.environment!;
    env.recipeVersion = 3;
    env.structures = [];
    for (let y = 0; y < 32; y += 2) {
      let start: number | null = null;
      for (let x = 0; x <= 32; x += 2) {
        const solid =
          x < 32 && !env.zones.some((z) => rectInside({ x, y, width: 2, height: 2 }, z.rect));
        if (solid && start === null) start = x;
        if (!solid && start !== null) {
          env.structures.push({
            id: `legacy_${x}_${y}`,
            label: "Legacy wall",
            rect: { x: start, y, width: x - start, height: 2 },
            style: "interior-wall",
            height: 1.4,
            blocksMovement: true,
            blocksShots: true,
          });
          start = null;
        }
      }
    }
    expect(readBattlefieldSnapshot(snapshot)).toEqual(snapshot);
  });

  it.each(["intersection", "alley"] as const)(
    "gives %s distinct building wings and dense edges",
    (kind) => {
      for (let seed = 1; seed <= 3; seed++) {
        const { arena } = composeScene(kind, seed).layout;
        const env = arena.environment!;
        expect(new Set(env.structures.map((s) => s.height)).size).toBeGreaterThanOrEqual(4);
        expect(
          new Set(env.structures.map((s) => `${s.rect.width}x${s.rect.height}`)).size,
        ).toBeGreaterThanOrEqual(4);
        expect(arena.cover!.length).toBeGreaterThanOrEqual(kind === "intersection" ? 22 : 15);
        expect(
          env.entrances!.every((e) => env.structures.some((s) => s.id === e.structureId)),
        ).toBe(true);
      }
    },
  );
});
