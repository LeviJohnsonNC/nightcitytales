/**
 * An atlas prop's registration is measured asset metadata. The contract that
 * matters: a change of condition may move where the feet sit in the cell, but
 * never the ground width, or a car would change size when it is shot.
 */
import { describe, expect, it } from "vitest";
import { atlasPropRegistration } from "../courtyard/atlasPropRegistration";
import { PROP_KINDS, type PropCondition, type PropKind } from "../courtyard/propPresentation";

const CONDITIONS: PropCondition[] = ["intact", "damaged", "wrecked"];
const ATLAS: PropKind[] = [...PROP_KINDS, "workbench", "food-cart"];

describe("atlasPropRegistration", () => {
  it("registers every yard prop kind and the atlas street kinds", () => {
    for (const kind of ATLAS)
      for (const condition of CONDITIONS)
        expect(() => atlasPropRegistration(kind, condition), kind).not.toThrow();
  });

  it("keeps the ground width the same across every condition", () => {
    for (const kind of ATLAS) {
      const widths = CONDITIONS.map((c) => atlasPropRegistration(kind, c).groundWidth);
      expect(new Set(widths).size, kind).toBe(1);
    }
  });

  it("keeps the horizontal origin the same across every condition", () => {
    for (const kind of ATLAS) {
      const xs = CONDITIONS.map((c) => atlasPropRegistration(kind, c).originX);
      expect(new Set(xs).size, kind).toBe(1);
    }
  });

  it("returns fractions of the cell", () => {
    for (const kind of ATLAS)
      for (const condition of CONDITIONS) {
        const r = atlasPropRegistration(kind, condition);
        for (const v of [r.originX, r.originY, r.groundWidth]) {
          expect(v).toBeGreaterThan(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
  });

  it("never raises the feet above the intact contact as the prop is wrecked", () => {
    // A wreck sits as low or lower in its cell (debris settles); never higher.
    for (const kind of ATLAS) {
      const [intact, damaged, wrecked] = CONDITIONS.map(
        (c) => atlasPropRegistration(kind, c).originY,
      );
      expect(damaged!, kind).toBeLessThanOrEqual(intact!);
      expect(wrecked!, kind).toBeLessThanOrEqual(damaged!);
    }
  });

  it("refuses a kind with no measured contact rather than guessing", () => {
    expect(() => atlasPropRegistration("sedan-engine", "intact")).toThrow(
      /Missing ground registration: sedan-engine/,
    );
  });
});
