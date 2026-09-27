import { describe, expect, it } from "vitest";
import { APPROACH_BY_DISPOSITION, comesOver, type HauntPerson } from "@/engine";

const person: HauntPerson = { key: "kiro", name: "Kiro", role: "friend", haunts: ["e3"] };

function rate(disposition: number): number {
  let yes = 0;
  const n = 2000;
  for (let day = 0; day < n; day++) {
    const args = { person, disposition, placeKey: "e3", day, minute: 21 * 60, seed: "c1" };
    if (comesOver(args)) yes++;
  }
  return yes / n;
}

describe("comesOver — whether somebody who is here crosses the room", () => {
  it("gives the same answer for the same evening", () => {
    const args = { person, disposition: 2, placeKey: "e3", day: 4, minute: 21 * 60, seed: "c1" };
    expect(comesOver(args)).toBe(comesOver(args));
  });

  it("follows the table, roughly, over many evenings", () => {
    for (const d of [-3, 0, 3]) {
      expect(Math.abs(rate(d) - APPROACH_BY_DISPOSITION[d]!)).toBeLessThan(0.05);
    }
  });

  it("is likelier for strong feelings either way than for none", () => {
    expect(rate(-3)).toBeGreaterThan(rate(0));
    expect(rate(3)).toBeGreaterThan(rate(0));
  });

  it("clamps a disposition off the scale rather than never coming", () => {
    const args = { person, disposition: 9, placeKey: "e3", day: 1, minute: 21 * 60, seed: "c1" };
    const clamped = { ...args, disposition: 3 };
    expect(comesOver(args)).toBe(comesOver(clamped));
  });
});
