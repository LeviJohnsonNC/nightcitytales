import { describe, expect, it } from "vitest";
import { TURN_LINE_POOL, turnLine, type TurnContext } from "../cityTurns";

const EVENING: TurnContext = {
  dayPart: "evening",
  districtName: "Rancho Coronado",
  placeName: "Eagle Rock Stadium",
  combatZone: false,
};

describe("the line shown while the city is thinking", () => {
  it("is the same line for the same turn, so it cannot change mid-wait", () => {
    const first = turnLine(EVENING, 7);
    for (let i = 0; i < 5; i++) expect(turnLine(EVENING, 7)).toEqual(first);
  });

  it("changes as the turns do", () => {
    const seen = new Set(Array.from({ length: 40 }, (_, seed) => turnLine(EVENING, seed).text));
    expect(seen.size).toBeGreaterThan(8);
  });

  it("never leaves a placeholder in the text", () => {
    for (let seed = 0; seed < 200; seed++) {
      const line = turnLine(EVENING, seed);
      expect(line.text).not.toMatch(/[{}]/);
      expect(line.text.trim()).not.toBe("");
    }
  });

  it("only names a place the character is actually standing in", () => {
    const nowhere: TurnContext = { dayPart: "night" };
    for (let seed = 0; seed < 200; seed++) {
      expect(turnLine(nowhere, seed).text).not.toMatch(/Rancho|Eagle/);
    }
  });

  it("keeps the time of day honest", () => {
    // "The signs come on" is an evening line; it must not show up at dawn.
    const morning: TurnContext = { dayPart: "morning" };
    const lines = Array.from({ length: 200 }, (_, s) => turnLine(morning, s).text);
    expect(lines).not.toContain("The signs come on one street at a time…");
  });

  it("says something different inside a Combat Zone than outside one", () => {
    const zone = { ...EVENING, combatZone: true };
    const civil = { ...EVENING, combatZone: false };
    const inZone = Array.from({ length: 200 }, (_, s) => turnLine(zone, s).text);
    const outside = Array.from({ length: 200 }, (_, s) => turnLine(civil, s).text);
    expect(inZone).toContain("Counting exits out of habit…");
    expect(outside).not.toContain("Counting exits out of habit…");
    expect(outside).toContain("The city bills you for standing still…");
  });

  it("never falls back to spinner language", () => {
    for (const line of TURN_LINE_POOL) {
      expect(line.text).not.toMatch(/loading|please wait|processing|thinking/i);
      // Every line trails off: the wait is unfinished, and so is the sentence.
      expect(line.text.endsWith("…")).toBe(true);
    }
  });

  it("only leans on context it declared it needs", () => {
    for (const line of TURN_LINE_POOL) {
      if (line.text.includes("{place}")) expect(line.needs).toContain("place");
      if (line.text.includes("{district}")) expect(line.needs).toContain("district");
    }
  });
});
