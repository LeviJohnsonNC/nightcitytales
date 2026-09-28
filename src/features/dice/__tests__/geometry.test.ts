/**
 * The dice as solids: every face flat, numbered like a real die, and every
 * value reachable — the resting orientation for a value always shows that
 * value's face to the player, upright.
 */
import { describe, expect, it } from "vitest";
import {
  D10,
  D6,
  dot,
  faceFor,
  frontFace,
  normalize,
  restingOrientation,
  rotate,
  sub,
  type Mesh,
} from "../geometry";

function flatness(mesh: Mesh): number {
  let worst = 0;
  for (const f of mesh.faces) {
    const [a, ...rest] = f.corners.map((i) => mesh.vertices[i]!);
    for (const p of rest) worst = Math.max(worst, Math.abs(dot(sub(p, a!), f.normal)));
  }
  return worst;
}

describe.each([
  ["d10", D10, 10, 11],
  ["d6", D6, 6, 7],
] as const)("the %s", (_name, mesh, sides, oppositeSum) => {
  it("has one face per number, each flat", () => {
    expect(mesh.faces.map((f) => f.value).sort((a, b) => a - b)).toEqual(
      Array.from({ length: sides }, (_, i) => i + 1),
    );
    expect(flatness(mesh)).toBeLessThan(1e-9);
  });

  it("numbers opposite faces the way a real die does", () => {
    for (const f of mesh.faces) {
      const opposite = mesh.faces.find((g) => dot(g.normal, f.normal) < -0.999);
      expect(opposite, `face ${f.value}`).toBeDefined();
      expect(f.value + opposite!.value).toBe(oppositeSum);
    }
  });

  it("shows exactly the rolled number, upright, when it comes to rest", () => {
    for (let value = 1; value <= sides; value += 1) {
      const q = restingOrientation(mesh, value);
      expect(frontFace(mesh, q).value, `value ${value}`).toBe(value);
      // Untilted, the face looks straight at the viewer with its number upright.
      const flat = restingOrientation(mesh, value, 0);
      const f = faceFor(mesh, value);
      const n = rotate(flat, f.normal);
      const up = rotate(flat, f.up);
      expect(n[2]).toBeCloseTo(1, 9);
      expect(normalize(up)[1]).toBeCloseTo(1, 9);
    }
  });
});
