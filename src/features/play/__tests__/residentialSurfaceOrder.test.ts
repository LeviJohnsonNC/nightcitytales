import { expect, it } from "vitest";
import { composeScene, type Point } from "@/engine";
import { paintSurfaceClasses } from "../courtyard/composedEnvironment";
import { SurfaceClass } from "../courtyard/groundReflection";

// Sample the actual painted material mask, including later overlays and buildings.
function sampleClass(arena: ReturnType<typeof composeScene>["layout"]["arena"], p: Point) {
  let points: Point[] = [],
    result = "";
  const ctx = {
    fillStyle: "",
    beginPath() {
      points = [];
    },
    moveTo(x: number, y: number) {
      points.push({ x, y });
    },
    lineTo(x: number, y: number) {
      points.push({ x, y });
    },
    closePath() {},
    fill() {
      if (
        p.x > Math.min(...points.map((q) => q.x)) &&
        p.x < Math.max(...points.map((q) => q.x)) &&
        p.y > Math.min(...points.map((q) => q.y)) &&
        p.y < Math.max(...points.map((q) => q.y))
      )
        result = this.fillStyle;
    },
  };
  paintSurfaceClasses(ctx as unknown as CanvasRenderingContext2D, arena, (p) => p);
  return result;
}
it.each([4, 5, 7])("seed %i retains concrete where a driveway crosses a planting strip", (seed) => {
  const arena = composeScene("residential", seed).layout.arena;
  const before = JSON.stringify(arena);
  const zones = arena.environment!.zones;
  let checked = 0;
  for (const drive of zones.filter((z) => z.kind === "driveway"))
    for (const bed of zones.filter((z) => z.kind === "frontage")) {
      const x = Math.max(drive.rect.x, bed.rect.x),
        y = Math.max(drive.rect.y, bed.rect.y);
      const right = Math.min(drive.rect.x + drive.rect.width, bed.rect.x + bed.rect.width);
      const bottom = Math.min(drive.rect.y + drive.rect.height, bed.rect.y + bed.rect.height);
      if (right <= x || bottom <= y) continue;
      expect(sampleClass(arena, { x: (x + right) / 2, y: (y + bottom) / 2 })).toBe(
        `rgb(${SurfaceClass.concrete},0,0)`,
      );
      checked++;
    }
  expect(checked).toBeGreaterThan(0);
  expect(JSON.stringify(arena)).toBe(before);
});
