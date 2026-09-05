import type { Point } from "@/engine";

/** Presentation only: invertible orthographic camera; canonical positions stay in metres. */
export function battlefieldProjection(width: number, height: number) {
  const scale = Math.min(
    900 / ((width + height) * Math.cos(Math.PI / 6)),
    480 / ((width + height) / 2),
  );
  const a = Math.cos(Math.PI / 6) * scale;
  const b = scale / 2;
  const origin = { x: 550 - ((width + height) * a) / 2, y: 340 - ((width - height) * b) / 2 };
  return {
    project: (p: Point): Point => ({
      x: origin.x + (p.x + p.y) * a,
      y: origin.y + (p.x - p.y) * b,
    }),
    unproject: (p: Point): Point => ({
      x: ((p.x - origin.x) / a + (p.y - origin.y) / b) / 2,
      y: ((p.x - origin.x) / a - (p.y - origin.y) / b) / 2,
    }),
  };
}
