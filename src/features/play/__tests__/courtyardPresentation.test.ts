import { describe, expect, it } from "vitest";
import { arenaFor, rectContains, coverStatuses, placeHostiles } from "@/engine";
import { battlefieldProjection } from "../battlefieldProjection";
import { courtyardCamera, routePosition } from "../courtyard/courtyardPresentation";

describe("courtyard presentation remains registered to the tactical input surface", () => {
  it.each([
    [1440, 750],
    [390, 440],
    [844, 280],
  ])("matches SVG letterboxing at %s by %s, with zoom and pan", (width, height) => {
    const view = { x: 87, y: -31, zoom: 1.75 };
    const camera = courtyardCamera(width, height, view);
    const { project, unproject } = battlefieldProjection(24, 24);
    for (const position of [
      { x: 0, y: 0 },
      { x: 24, y: 24 },
      { x: 8.7, y: 12.4 },
    ]) {
      const p = project(position);
      const screen = {
        x: (p.x - camera.x) * camera.zoom + width / 2,
        y: (p.y - camera.y) * camera.zoom + height / 2,
      };
      // SVG viewBox xMidYMid meet, independently reconstructed.
      const vw = 1100 / view.zoom,
        vh = 680 / view.zoom;
      const scale = Math.min(width / vw, height / vh);
      const fromSvg = unproject({
        x: (screen.x - (width - vw * scale) / 2) / scale + 550 - vw / 2 + view.x,
        y: (screen.y - (height - vh * scale) / 2) / scale + 340 - vh / 2 + view.y,
      });
      expect(fromSvg.x).toBeCloseTo(position.x);
      expect(fromSvg.y).toBeCloseTo(position.y);
    }
  });
  it("plays unequal route segments at constant speed without cutting the corner", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 8, y: 2 },
    ];
    expect(routePosition(path, 0.1)).toEqual({ x: 0, y: 1 });
    expect(routePosition(path, 0.5)).toEqual({ x: 3, y: 2 });
    expect(routePosition(path, 2)).toEqual({ x: 8, y: 2 });
    expect(routePosition(path, -1)).toEqual({ x: 0, y: 0 });
    expect(routePosition([], 0.5)).toBeNull();
    expect(
      routePosition(
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
        ],
        0.5,
      ),
    ).toEqual({ x: 1, y: 1 });
    expect(path[0]).toEqual({ x: 0, y: 0 });
  });
  it("keeps authored starts and cover on playable ground, with no spawn inside a crate", () => {
    const arena = arenaFor("night_shift");
    expect(arena.key).toBe("night_shift");
    for (const point of [arena.playerStart, ...placeHostiles(arena, 6)]) {
      for (const cover of arena.cover ?? []) expect(rectContains(cover.rect, point)).toBe(false);
    }
    for (const status of coverStatuses(arena, {})) {
      expect(status.hp).toBeGreaterThan(0);
      expect(status.piece.rect.x + status.piece.rect.width).toBeLessThanOrEqual(arena.extent.width);
      expect(status.piece.rect.y + status.piece.rect.height).toBeLessThanOrEqual(
        arena.extent.height,
      );
    }
  });
});
